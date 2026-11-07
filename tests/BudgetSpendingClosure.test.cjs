'use strict';
// Integration: demo-budgy Auth/Firestore/Functions emulators only.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { createRequire } = require('node:module');
const path = require('node:path');
const fromFunctions = createRequire(path.resolve(__dirname,'../functions/package.json'));
const { initializeApp, deleteApp } = fromFunctions('firebase-admin/app');
const { getFirestore } = fromFunctions('firebase-admin/firestore');
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.GCLOUD_PROJECT = 'demo-budgy';
const BASE='http://127.0.0.1:5001/demo-budgy/us-central1';
async function signUp() {
  const r=await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:`${randomUUID()}@example.test`,password:`Test!${randomUUID()}`,returnSecureToken:true})});
  const x=await r.json();assert.equal(r.status,200,JSON.stringify(x));return x;
}
async function call(name,data,token) {
  const r=await fetch(`${BASE}/${name}`,{method:'POST',headers:{'content-type':'application/json',...(token?{authorization:`Bearer ${token}`}:{})},body:JSON.stringify({data})});return {status:r.status,body:await r.json()};
}
function ok(r){assert.equal(r.status,200,JSON.stringify(r.body));return r.body.result;}
const date='2026-10-15', periodId='grocery_2026-10-01';
const money=(requestId,amountCents,extra={})=>({requestId,amountCents,effectiveDate:date,...extra});
test('budget spending and period close preserve money and history', async t => {
 const app=initializeApp({projectId:'demo-budgy'},`budget-spend-${randomUUID()}`);
 try {
  const alice=await signUp(),bob=await signUp(), auth=alice.idToken;
  const base=getFirestore(app).collection('users').doc(alice.localId);
  const summary=()=>base.collection('summaries').doc('current').get().then(s=>s.data());
  const period=()=>base.collection('budgetPeriods').doc(periodId).get().then(s=>s.data());
  await t.test('setup account and budget',async()=>{
   ok(await call('initializeAccount',money('open',100000),auth));
   ok(await call('createCategory',{requestId:'cat',categoryId:'food',name:'Food',type:'expense'},auth));
   ok(await call('createBudgetRule',{requestId:'rule',budgetId:'grocery',name:'Groceries',categoryId:'food',limitCents:20000,frequency:'monthly'},auth));
   ok(await call('openBudgetPeriod',{requestId:'openperiod',budgetId:'grocery',effectiveDate:date},auth));
   ok(await call('allocateFunds',money('fund',50000,{destinationKey:'budget:grocery'}),auth));
  });
  await t.test('reject unlinked spending on managed budget and future opening',async()=>{
   const noPeriod=await call('recordExpense',money('noPeriod',1000,{sourceKey:'budget:grocery'}),auth);
   assert.equal(noPeriod.status,400,JSON.stringify(noPeriod.body));
   const opening=await call('openBudgetPeriod',{requestId:'nextperiod',budgetId:'grocery',effectiveDate:'2026-11-03'},auth);
   assert.equal(opening.status,400,JSON.stringify(opening.body));
  });
  await t.test('expense updates spent and variance in same transaction',async()=>{
   const cmd=money('bigexpense',22500,{sourceKey:'budget:grocery',budgetPeriodId:periodId,categoryId:'food',description:'Food'});
   ok(await call('recordExpense',cmd,auth));
   assert.equal((await period()).spentCents,22500);
   assert.equal((await period()).varianceCents,-2500);
   assert.equal((await summary()).accounts['budget:grocery'],27500);
   const txn=await base.collection('transactions').doc('expense_bigexpense').get();
   assert.equal(txn.data().budgetPeriodId,periodId);
   const replay=ok(await call('recordExpense',cmd,auth));
   assert.equal(replay.duplicate,true);
   assert.equal((await period()).spentCents,22500);
  });
  await t.test('wrong period and date rejected',async()=>{
   for(const item of [
    money('wrongperiod',100,{sourceKey:'budget:grocery',budgetPeriodId:'grocery_2026-09-01'}),
    money('wrongdate',100,{sourceKey:'budget:grocery',budgetPeriodId:periodId,effectiveDate:'2026-11-01'}),
   ])assert.notEqual((await call('recordExpense',item,auth)).status,200);
  });
  await t.test('linked corrections fail closed instead of corrupting spent totals',async()=>{
   const r=await call('reverseTransaction',{requestId:'noReverse',transactionId:'expense_bigexpense'},auth);
   assert.equal(r.status,400,JSON.stringify(r.body));
   assert.equal((await period()).spentCents,22500);
  });
  await t.test('close releases unused reserve exactly once',async()=>{
   const cmd={requestId:'closebudget',budgetId:'grocery',periodId};
   const result=ok(await call('closeBudgetPeriod',cmd,auth));
   assert.equal(result.releasedCents,27500);
   assert.equal((await period()).status,'closed');
   assert.equal((await period()).spentCents,22500);
   assert.equal((await period()).varianceCents,-2500);
   assert.equal((await summary()).trackedTotalCents,77500);
   assert.equal((await summary()).unallocatedCents,77500);
   assert.equal((await summary()).accounts['budget:grocery'],0);
   assert.equal((await base.collection('journal').doc('release_closebudget').get()).exists,true);
   assert.equal(ok(await call('closeBudgetPeriod',cmd,auth)).duplicate,true);
   assert.equal((await call('closeBudgetPeriod',{...cmd,requestId:'closeAgain'},auth)).status,400);
  });
  await t.test('cannot spend against closed period; next period can open',async()=>{
   assert.equal((await call('recordExpense',money('late',100,{sourceKey:'budget:grocery',budgetPeriodId:periodId}),auth)).status,400);
   const next=ok(await call('openBudgetPeriod',{requestId:'nextPeriodValid',budgetId:'grocery',effectiveDate:'2026-11-03'},auth));
   assert.equal(next.startDate,'2026-11-01');
   assert.equal(next.spentCents,0);
  });
  await t.test('cannot close another users period',async()=>{
   const r=await call('closeBudgetPeriod',{requestId:'bobClose',budgetId:'grocery',periodId},bob.idToken);
   assert.equal(r.status,404,JSON.stringify(r.body));
  });
 }finally{await deleteApp(app)}
});

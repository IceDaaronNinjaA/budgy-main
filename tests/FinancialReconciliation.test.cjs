'use strict';
// Emulator integration: demo-budgy auth:9099 firestore:8080 functions:5001
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const {createRequire}=require('node:module');
const path=require('node:path');
const fns=createRequire(path.resolve(__dirname,'../functions/package.json'));
const {initializeApp,deleteApp}=fns('firebase-admin/app');
const {getFirestore}=fns('firebase-admin/firestore');
process.env.FIRESTORE_EMULATOR_HOST='127.0.0.1:8080';
process.env.GCLOUD_PROJECT='demo-budgy';
const BASE='http://127.0.0.1:5001/demo-budgy/us-central1';
async function signup(){const r=await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:`${randomUUID()}@example.test`,password:`T!${randomUUID()}`,returnSecureToken:true})});const x=await r.json();assert.equal(r.status,200,JSON.stringify(x));return x;}
async function call(name,data,token){const r=await fetch(`${BASE}/${name}`,{method:'POST',headers:{'content-type':'application/json',...(token?{authorization:`Bearer ${token}`}:{})},body:JSON.stringify({data})});return {status:r.status,body:await r.json()};}
function ok(r){assert.equal(r.status,200,JSON.stringify(r.body));return r.body.result;}
const today=new Date().toISOString().slice(0,10);
const previousMonth=new Date(Date.UTC(+today.slice(0,4),+today.slice(5,7)-2,15)).toISOString().slice(0,10);
const thisMonth=today.slice(0,7);
test('reconcile safely closes expired budgets, opens current schedules and partially funds in priority order', async t=>{
 const app=initializeApp({projectId:'demo-budgy'},`reconcile-${randomUUID()}`);
 try{
  const alice=await signup(),bob=await signup(),token=alice.idToken;
  const base=getFirestore(app).collection('users').doc(alice.localId);
  const summary=async()=> (await base.collection('summaries').doc('current').get()).data();
  await t.test('authentication required',async()=>assert.equal((await call('reconcileFinancialSchedule',{})).status,401));
  await t.test('setup previous budget and new bill',async()=>{
   ok(await call('initializeAccount',{requestId:'init',amountCents:6000,effectiveDate:today},token));
   ok(await call('createCategory',{requestId:'cat',categoryId:'housing',name:'Housing',type:'expense'},token));
   ok(await call('createBudgetRule',{requestId:'createBudget',budgetId:'food',name:'Food',categoryId:'housing',limitCents:4000,frequency:'monthly'},token));
   ok(await call('openBudgetPeriod',{requestId:'oldBudget',budgetId:'food',effectiveDate:previousMonth},token));
   ok(await call('allocateFunds',{requestId:'oldReserve',amountCents:3000,effectiveDate:previousMonth,destinationKey:'budget:food'},token));
   ok(await call('createBillRule',{requestId:'createBill',billId:'rent',name:'Rent',amountCents:5000,categoryId:'housing',dayOfMonth:31},token));
   ok(await call('configureFundingRule',{requestId:'confBudget',kind:'budget',ruleId:'food',enabled:true,targetCents:4000,priority:1},token));
   ok(await call('configureFundingRule',{requestId:'confBill',kind:'bill',ruleId:'rent',enabled:true,targetCents:5000,priority:2},token));
  });
  await t.test('old budget is closed, money released, new schedules opened, and $60 allocated',async()=>{
   const r=ok(await call('reconcileFinancialSchedule',{},token));
   assert.equal(r.partial,false,JSON.stringify(r));
   assert.equal(r.dateBasis,'UTC');
   const prior=new Date(previousMonth+'T00:00:00Z'), priorKey=`food_${prior.toISOString().slice(0,7)}-01`;
   assert.equal((await base.collection('budgetPeriods').doc(priorKey).get()).data().status,'closed');
   assert.equal((await base.collection('budgetPeriods').doc(`food_${thisMonth}-01`).get()).data().status,'open');
   assert.equal((await base.collection('billOccurrences').doc(`rent_${thisMonth}`).get()).data().status,'unpaid');
   assert.equal(r.funding.allocations.length,2);
   assert.deepEqual(r.funding.allocations.map(x=>x.allocatedCents),[4000,2000]);
   const s=await summary();
   assert.equal(s.trackedTotalCents,6000);
   assert.equal(s.unallocatedCents,0);
   assert.equal(s.accounts['budget:food'],4000);
   assert.equal(s.accounts['bill:rent'],2000);
  });
  await t.test('repeat does not allocate twice or pay an unpaid bill',async()=>{
   const r=ok(await call('reconcileFinancialSchedule',{},token));
   assert.equal(r.partial,false,JSON.stringify(r));
   assert.equal(r.funding.eventsCreated,0);
   assert.equal((await summary()).trackedTotalCents,6000);
   const occurrence=(await base.collection('billOccurrences').doc(`rent_${thisMonth}`).get()).data();
   assert.equal(occurrence.status,'unpaid');
   assert.equal(occurrence.fundedCents,2000);
  });
  await t.test('new income allows remaining shortfall to be filled on reconciliation',async()=>{
   ok(await call('recordIncome',{requestId:'incomeLater',amountCents:3000,effectiveDate:today},token));
   const r=ok(await call('reconcileFinancialSchedule',{},token));
   assert.equal(r.funding.eventsCreated,1);
   assert.deepEqual(r.funding.allocations.map(x=>x.allocatedCents),[0,3000]);
   const s=await summary();
   assert.equal(s.trackedTotalCents,9000);
   assert.equal(s.accounts['bill:rent'],5000);
  });
  await t.test('another user cannot access or reconcile Alice finances',async()=>{
   assert.equal((await call('reconcileFinancialSchedule',{},bob.idToken)).status,400);
   assert.equal((await summary()).trackedTotalCents,9000);
  });
 }finally{await deleteApp(app);}
});

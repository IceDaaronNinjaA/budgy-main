'use strict';
// Run with demo-budgy Auth, Firestore, Functions emulators.
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
async function signup(){
 const r=await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key',{
  method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:`${randomUUID()}@example.test`,password:`Pass!${randomUUID()}`,returnSecureToken:true})});
 const x=await r.json();assert.equal(r.status,200,JSON.stringify(x));return x;
}
async function call(name,data,token){
 const r=await fetch(`${BASE}/${name}`,{method:'POST',headers:{'content-type':'application/json',...(token?{authorization:`Bearer ${token}`}:{})},body:JSON.stringify({data})});
 return {status:r.status,body:await r.json()};
}
function ok(r){assert.equal(r.status,200,JSON.stringify(r.body));return r.body.result;}

test('automation settings are authenticated, timezone-aware, and idempotent',async t=>{
 const app=initializeApp({projectId:'demo-budgy'},`automation-${randomUUID()}`);
 try{
  const alice=await signup(),bob=await signup(),token=alice.idToken;
  const base=getFirestore(app).collection('users').doc(alice.localId);
  await t.test('authentication and initialized account required',async()=>{
   assert.equal((await call('setFinancialAutomationSettings',{requestId:'unauth',enabled:true,timeZone:'America/Boise'})).status,401);
   assert.equal((await call('setFinancialAutomationSettings',{requestId:'notInit',enabled:true,timeZone:'America/Boise'},token)).status,400);
   ok(await call('initializeAccount',{requestId:'open',amountCents:100000,effectiveDate:'2026-11-06'},token));
  });
  await t.test('reject unknown timezones without changing settings',async()=>{
   const r=await call('setFinancialAutomationSettings',{requestId:'invalid',enabled:true,timeZone:'Nowhere/Whatever'},token);
   assert.equal(r.status,400,JSON.stringify(r.body));
   assert.equal((await base.collection('settings').doc('financialAutomation').get()).exists,false);
  });
  await t.test('opt in, replay, conflicting replay and opt out',async()=>{
   const cmd={requestId:'optin',enabled:true,timeZone:'America/Boise'};
   const first=ok(await call('setFinancialAutomationSettings',cmd,token));assert.equal(first.enabled,true);
   assert.equal(ok(await call('setFinancialAutomationSettings',cmd,token)).duplicate,true);
   assert.equal((await call('setFinancialAutomationSettings',{...cmd,timeZone:'UTC'},token)).status,409);
   assert.equal((await base.collection('settings').doc('financialAutomation').get()).data().timeZone,'America/Boise');
   const out=ok(await call('setFinancialAutomationSettings',{requestId:'optout',enabled:false,timeZone:'America/Boise'},token));
   assert.equal(out.enabled,false);
  });
  await t.test('other users cannot modify owner settings',async()=>{
   assert.equal((await call('setFinancialAutomationSettings',{requestId:'bob',enabled:true,timeZone:'UTC'},bob.idToken)).status,400);
   assert.equal((await base.collection('settings').doc('financialAutomation').get()).data().enabled,false);
  });
  await t.test('reconciliation returns configured local date basis',async()=>{
   const r=ok(await call('reconcileFinancialSchedule',{},token));
   assert.equal(r.dateBasis,'America/Boise');
   assert.match(r.asOfDate,/^\d{4}-\d{2}-\d{2}$/);
  });
 }finally{await deleteApp(app);}
});

test('paid bill transactions cannot be mutated through generic correction functions',async t=>{
 const app=initializeApp({projectId:'demo-budgy'},`bill-corrections-${randomUUID()}`);
 try{
  const alice=await signup(),token=alice.idToken;
  const base=getFirestore(app).collection('users').doc(alice.localId);
  ok(await call('initializeAccount',{requestId:'open',amountCents:50000,effectiveDate:'2026-11-06'},token));
  ok(await call('createCategory',{requestId:'cat',categoryId:'housing',name:'Housing',type:'expense'},token));
  ok(await call('createBillRule',{requestId:'rentRule',billId:'rent',name:'Rent',amountCents:20000,dayOfMonth:6,categoryId:'housing'},token));
  ok(await call('openBillOccurrence',{requestId:'rentNov',billId:'rent',month:'2026-11'},token));
  ok(await call('fundBillOccurrence',{requestId:'fund',billId:'rent',occurrenceId:'rent_2026-11',amountCents:20000,effectiveDate:'2026-11-06'},token));
  ok(await call('confirmBillPayment',{requestId:'pay',billId:'rent',occurrenceId:'rent_2026-11',effectiveDate:'2026-11-06'},token));
  const summary=()=>base.collection('summaries').doc('current').get().then(s=>s.data());
  await t.test('generic reversal and correction fail closed',async()=>{
   const reversal=await call('reverseTransaction',{requestId:'undoBill',transactionId:'bill_pay_pay'},token);
   assert.equal(reversal.status,400,JSON.stringify(reversal.body));
   const correction=await call('correctTransaction',{requestId:'changeBill',transactionId:'bill_pay_pay',amountCents:1000,effectiveDate:'2026-11-06'},token);
   assert.equal(correction.status,400,JSON.stringify(correction.body));
   assert.equal((await summary()).trackedTotalCents,30000);
   assert.equal((await base.collection('billOccurrences').doc('rent_2026-11').get()).data().status,'paid');
   assert.equal((await base.collection('transactions').doc('bill_pay_pay').get()).data().status,'active');
   assert.equal((await base.collection('journal').doc('reversal_undoBill').get()).exists,false);
  });
 }finally{await deleteApp(app);}
});

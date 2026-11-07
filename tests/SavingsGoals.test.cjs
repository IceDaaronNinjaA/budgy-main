'use strict';
// Emulator-only: Auth 9099, Firestore 8080, Functions 5001, demo-budgy.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const {createRequire}=require('node:module');
const path=require('node:path');
const fromFunctions=createRequire(path.resolve(__dirname,'../functions/package.json'));
const {initializeApp,deleteApp}=fromFunctions('firebase-admin/app');
const {getFirestore}=fromFunctions('firebase-admin/firestore');
process.env.FIRESTORE_EMULATOR_HOST='127.0.0.1:8080';
process.env.GCLOUD_PROJECT='demo-budgy';
const BASE='http://127.0.0.1:5001/demo-budgy/us-central1';
async function signUp(){
 const r=await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key',{
  method:'POST',headers:{'content-type':'application/json'},
  body:JSON.stringify({email:`${randomUUID()}@example.test`,password:`Test!${randomUUID()}`,returnSecureToken:true})});
 const body=await r.json();assert.equal(r.status,200,JSON.stringify(body));return body;
}
async function call(name,data,token){
 const r=await fetch(`${BASE}/${name}`,{method:'POST',headers:{'content-type':'application/json',
  ...(token?{authorization:`Bearer ${token}`}:{})},body:JSON.stringify({data})});
 return {status:r.status,body:await r.json()};
}
function ok(r){assert.equal(r.status,200,JSON.stringify(r.body));return r.body.result;}
const create={requestId:'goal_create',goalId:'trip',name:'  Vacation  ',targetCents:300000,startDate:'2026-11-01',deadlineDate:'2027-02-28'};
const cash=(requestId,amountCents)=>({requestId,goalId:'trip',amountCents,effectiveDate:'2026-11-06'});
test('savings goals: authenticated lifecycle and balanced reserve transfers',async t=>{
 const app=initializeApp({projectId:'demo-budgy'},`savings-${randomUUID()}`);
 try{
  const alice=await signUp(),bob=await signUp(),auth=alice.idToken;
  const base=getFirestore(app).collection('users').doc(alice.localId);
  const summary=()=>base.collection('summaries').doc('current').get().then(s=>s.data());
  const goal=()=>base.collection('savingsGoals').doc('trip').get().then(s=>s.data());
  await t.test('authentication required',async()=>{
   assert.equal((await call('createSavingsGoal',create)).status,401);
  });
  await t.test('initialization required',async()=>{
   assert.equal((await call('createSavingsGoal',create,auth)).status,400);
  });
  await t.test('initialize account, create goal, and normalize name',async()=>{
   ok(await call('initializeAccount',{requestId:'opening_goal',amountCents:100000,effectiveDate:'2026-11-01'},auth));
   const r=ok(await call('createSavingsGoal',create,auth));
   assert.equal(r.name,'Vacation');assert.equal(r.savedCents,0);
   assert.equal((await goal()).targetCents,300000);
   assert.equal((await summary()).trackedTotalCents,100000);
  });
  await t.test('idempotency and request collision',async()=>{
   assert.equal(ok(await call('createSavingsGoal',create,auth)).duplicate,true);
   assert.equal((await call('createSavingsGoal',{...create,name:'Different'},auth)).status,409);
   assert.equal((await call('createSavingsGoal',{...create,requestId:'duplicate_goal'},auth)).status,409);
  });
  await t.test('contribution moves money, not tracked total',async()=>{
   const r=ok(await call('contributeToSavingsGoal',cash('save_1',20000),auth));
   assert.equal(r.savedCents,20000);
   const state=await summary();assert.equal(state.accounts['goal:trip'],20000);
   assert.equal(state.unallocatedCents,80000);assert.equal(state.trackedTotalCents,100000);
   assert.equal((await base.collection('journal').doc('goal_contribute_save_1').get()).exists,true);
   assert.equal(ok(await call('contributeToSavingsGoal',cash('save_1',20000),auth)).duplicate,true);
   assert.equal((await summary()).accounts['goal:trip'],20000);
  });
  await t.test('withdrawal restores unallocated and cannot overdraft goal',async()=>{
   const r=ok(await call('withdrawFromSavingsGoal',cash('withdraw_1',5000),auth));
   assert.equal(r.savedCents,15000);
   assert.equal((await summary()).unallocatedCents,85000);
   assert.equal((await call('withdrawFromSavingsGoal',cash('overdraw',20000),auth)).status,400);
   assert.equal((await summary()).accounts['goal:trip'],15000);
  });
  await t.test('update goal retains balance and recalculates pace',async()=>{
   const r=ok(await call('updateSavingsGoal',{...create,requestId:'goal_update',name:'Summer',targetCents:200000},auth));
   assert.equal(r.name,'Summer');assert.equal(r.savedCents,15000);
   assert.equal(r.targetCents,200000);assert.equal((await goal()).name,'Summer');
  });
  await t.test('pausing prevents new contributions and resuming allows them',async()=>{
   ok(await call('setSavingsGoalPaused',{requestId:'pause_goal',goalId:'trip',paused:true},auth));
   assert.equal((await call('contributeToSavingsGoal',cash('blocked',100),auth)).status,400);
   ok(await call('setSavingsGoalPaused',{requestId:'resume_goal',goalId:'trip',paused:false},auth));
   ok(await call('contributeToSavingsGoal',cash('save_2',100),auth));
   assert.equal((await summary()).accounts['goal:trip'],15100);
  });
  await t.test('invalid dates and amounts are rejected',async()=>{
   assert.equal((await call('createSavingsGoal',{...create,requestId:'bad_date',goalId:'bad',deadlineDate:'2026-02-30'},auth)).status,400);
   assert.equal((await call('contributeToSavingsGoal',cash('bad_cents',-1),auth)).status,400);
   assert.equal((await call('updateSavingsGoal',{...create,requestId:'bad_target',targetCents:0},auth)).status,400);
  });
  await t.test('another user cannot alter goal or balance',async()=>{
   assert.equal((await call('contributeToSavingsGoal',cash('bob_contrib',100),bob.idToken)).status,400);
   assert.equal((await summary()).accounts['goal:trip'],15100);
  });
 }finally{await deleteApp(app);}
});

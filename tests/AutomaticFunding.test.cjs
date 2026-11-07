'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');const {createRequire}=require('node:module');const path=require('node:path');
const fns=createRequire(path.resolve(__dirname,'../functions/package.json'));
const {initializeApp,deleteApp}=fns('firebase-admin/app');const {getFirestore}=fns('firebase-admin/firestore');
process.env.FIRESTORE_EMULATOR_HOST='127.0.0.1:8080';process.env.GCLOUD_PROJECT='demo-budgy';
const BASE='http://127.0.0.1:5001/demo-budgy/us-central1';
async function signup(){const r=await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:`${randomUUID()}@example.test`,password:`Test!${randomUUID()}`,returnSecureToken:true})});const x=await r.json();assert.equal(r.status,200,JSON.stringify(x));return x;}
async function call(name,data,token){const r=await fetch(`${BASE}/${name}`,{method:'POST',headers:{'content-type':'application/json',...(token?{authorization:`Bearer ${token}`}:{})},body:JSON.stringify({data})});return {status:r.status,body:await r.json()};}
function ok(r){assert.equal(r.status,200,JSON.stringify(r.body));return r.body.result;}
test('priority auto funding conserves money and resumes shortfalls',async t=>{
 const app=initializeApp({projectId:'demo-budgy'},`autofunding-${randomUUID()}`);
 try{
  const alice=await signup(),bob=await signup(),auth=alice.idToken;
  const base=getFirestore(app).collection('users').doc(alice.localId);
  const summary=async()=> (await base.collection('summaries').doc('current').get()).data();
  await t.test('authentication required',async()=>{assert.equal((await call('runFundingCycle',{requestId:'unauth',effectiveDate:'2026-11-06'})).status,401);});
  await t.test('setup three active rules',async()=>{
   ok(await call('initializeAccount',{requestId:'start',amountCents:10000,effectiveDate:'2026-11-06'},auth));
   ok(await call('createCategory',{requestId:'category',categoryId:'housing',name:'Housing',type:'expense'},auth));
   for(const [id,limit] of [['first',8000],['third',5000]]){
    ok(await call('createBudgetRule',{requestId:`create_${id}`,budgetId:id,name:id,categoryId:'housing',limitCents:limit,frequency:'monthly'},auth));
    ok(await call('openBudgetPeriod',{requestId:`open_${id}`,budgetId:id,effectiveDate:'2026-11-06'},auth));
   }
   ok(await call('createBillRule',{requestId:'bill',billId:'second',name:'Power',amountCents:7000,categoryId:'housing',dayOfMonth:10},auth));
   ok(await call('openBillOccurrence',{requestId:'billOpen',billId:'second',month:'2026-11'},auth));
   for(const [kind,id,priority,target] of [['budget','first',1,8000],['bill','second',2,7000],['budget','third',3,5000]]){
    ok(await call('configureFundingRule',{requestId:`configure_${id}`,kind,ruleId:id,enabled:true,targetCents:target,priority},auth));
   }
  });
  await t.test('first cycle applies $80 then $20 then $0',async()=>{
   const cmd={requestId:'cycle1',effectiveDate:'2026-11-06'};
   const r=ok(await call('runFundingCycle',cmd,auth));
   assert.deepEqual(r.allocations.map(x=>x.allocatedCents),[8000,2000,0]);
   assert.deepEqual(r.allocations.map(x=>x.remainingCents),[0,5000,5000]);
   assert.equal(r.trackedTotalCents,10000);assert.equal(r.unallocatedCents,0);
   assert.equal((await summary()).accounts['bill:second'],2000);
   assert.equal((await base.collection('billOccurrences').doc('second_2026-11').get()).data().fundedCents,2000);
   assert.equal(ok(await call('runFundingCycle',cmd,auth)).duplicate,true);
   assert.equal((await summary()).trackedTotalCents,10000);
  });
  await t.test('income $120 fills shortfalls and leaves $20',async()=>{
   ok(await call('recordIncome',{requestId:'paycheck',amountCents:12000,effectiveDate:'2026-11-06'},auth));
   const r=ok(await call('runFundingCycle',{requestId:'cycle2',effectiveDate:'2026-11-06'},auth));
   assert.deepEqual(r.allocations.map(x=>x.allocatedCents),[0,5000,5000]);
   assert.equal(r.trackedTotalCents,22000);assert.equal(r.unallocatedCents,2000);
   assert.equal((await summary()).accounts['bill:second'],7000);
  });
  await t.test('third cycle does not double-fund',async()=>{
   const r=ok(await call('runFundingCycle',{requestId:'cycle3',effectiveDate:'2026-11-06'},auth));
   assert.equal(r.eventsCreated,0);assert.equal(r.unallocatedCents,2000);
  });
  await t.test('paused rules and user isolation',async()=>{
   ok(await call('setBillPaused',{requestId:'pause',billId:'second',paused:true},auth));
   const r=ok(await call('runFundingCycle',{requestId:'cycle4',effectiveDate:'2026-11-06'},auth));
   assert.equal(r.allocations.some(x=>x.ruleId==='second'),false);
   assert.equal((await call('configureFundingRule',{requestId:'bobTry',kind:'budget',ruleId:'first',enabled:true,targetCents:1,priority:1},bob.idToken)).status,404);
   assert.equal((await summary()).trackedTotalCents,22000);
  });
 }finally{await deleteApp(app);}
});

'use strict';
// Run with demo-budgy Auth/Firestore/Functions emulators (9099/8080/5001).
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
 const res=await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key',{
  method:'POST',headers:{'content-type':'application/json'},
  body:JSON.stringify({email:`${randomUUID()}@example.test`,password:`Test!${randomUUID()}`,returnSecureToken:true})
 });
 const body=await res.json();assert.equal(res.status,200,JSON.stringify(body));return body;
}
async function call(name,data,token){
 const res=await fetch(`${BASE}/${name}`,{method:'POST',headers:{'content-type':'application/json',...(token?{authorization:`Bearer ${token}`}:{})},body:JSON.stringify({data})});
 return {status:res.status,body:await res.json()};
}
function ok(result){assert.equal(result.status,200,JSON.stringify(result.body));return result.body.result;}
const effectiveDate='2026-11-06';
const cmd=(requestId,amountCents,fields={})=>({requestId,amountCents,effectiveDate,...fields});
test('managed bill reserves cannot be bypassed by generic ledger commands',async t=>{
 const app=initializeApp({projectId:'demo-budgy'},`bill-guard-${randomUUID()}`);
 try{
  const alice=await signup(),auth=alice.idToken;
  const base=getFirestore(app).collection('users').doc(alice.localId);
  const summary=async()=> (await base.collection('summaries').doc('current').get()).data();
  await t.test('setup managed and unmanaged bill reserves',async()=>{
   ok(await call('initializeAccount',cmd('open',100000),auth));
   ok(await call('createCategory',{requestId:'cat',categoryId:'housing',name:'Housing',type:'expense'},auth));
   ok(await call('createBillRule',{requestId:'rule',billId:'rent',name:'Rent',amountCents:30000,categoryId:'housing',dayOfMonth:6},auth));
   ok(await call('openBillOccurrence',{requestId:'occ',billId:'rent',month:'2026-11'},auth));
   // Backward compatibility: generic operations are still permitted for
   // unmanaged (ad-hoc) reserve keys.
   ok(await call('allocateFunds',cmd('misc',1000,{destinationKey:'bill:ad_hoc'}),auth));
   assert.equal((await summary()).accounts['bill:ad_hoc'],1000);
  });
  await t.test('generic allocate, release, transfer and expense reject managed bill',async()=>{
   const attempts=[
    ['allocateFunds',cmd('genericAlloc',1000,{destinationKey:'bill:rent'})],
    ['releaseFunds',cmd('genericRelease',1000,{sourceKey:'bill:rent'})],
    ['transferFunds',cmd('genericFrom',1000,{sourceKey:'bill:rent',destinationKey:'unallocated'})],
    ['transferFunds',cmd('genericTo',1000,{sourceKey:'unallocated',destinationKey:'bill:rent'})],
    ['recordExpense',cmd('genericExpense',1000,{sourceKey:'bill:rent'})],
   ];
   for(const [name,data] of attempts){
    const response=await call(name,data,auth);
    assert.equal(response.status,400,`${name}: ${JSON.stringify(response.body)}`);
   }
   assert.equal((await summary()).trackedTotalCents,100000);
   assert.equal((await summary()).accounts['bill:rent']??0,0);
   assert.equal((await base.collection('billOccurrences').doc('rent_2026-11').get()).data().fundedCents,0);
  });
  await t.test('dedicated bill operations still fund and confirm payment exactly once',async()=>{
   ok(await call('fundBillOccurrence',cmd('fund',30000,{billId:'rent',occurrenceId:'rent_2026-11'}),auth));
   assert.equal((await summary()).accounts['bill:rent'],30000);
   // Even after funding, generic operations must not bypass bill tracking.
   assert.equal((await call('releaseFunds',cmd('steal',2000,{sourceKey:'bill:rent'}),auth)).status,400);
   assert.equal((await summary()).accounts['bill:rent'],30000);
   const pay={requestId:'pay',billId:'rent',occurrenceId:'rent_2026-11',effectiveDate};
   ok(await call('confirmBillPayment',pay,auth));
   assert.equal((await summary()).trackedTotalCents,70000);
   assert.equal((await summary()).accounts['bill:rent'],0);
   assert.equal((await base.collection('billOccurrences').doc('rent_2026-11').get()).data().status,'paid');
   assert.equal(ok(await call('confirmBillPayment',pay,auth)).duplicate,true);
   assert.equal((await summary()).trackedTotalCents,70000);
  });
  await t.test('unmanaged reserve still supports allocate, release and transfer',async()=>{
   ok(await call('releaseFunds',cmd('miscRelease',500,{sourceKey:'bill:ad_hoc'}),auth));
   assert.equal((await summary()).accounts['bill:ad_hoc'],500);
   ok(await call('transferFunds',cmd('miscTransfer',500,{sourceKey:'bill:ad_hoc',destinationKey:'unallocated'}),auth));
   assert.equal((await summary()).accounts['bill:ad_hoc'],0);
   assert.equal((await summary()).trackedTotalCents,70000);
  });
 }finally{await deleteApp(app);}
});

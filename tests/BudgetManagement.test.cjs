'use strict';
// Emulator only. Auth:9099, Firestore:8080, Functions:5001, project demo-budgy.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { createRequire } = require('node:module');
const path = require('node:path');
const fromFunctions = createRequire(path.resolve(__dirname, '../functions/package.json'));
const { initializeApp, deleteApp } = fromFunctions('firebase-admin/app');
const { getFirestore } = fromFunctions('firebase-admin/firestore');
process.env.FIRESTORE_EMULATOR_HOST='127.0.0.1:8080';
process.env.GCLOUD_PROJECT='demo-budgy';
const BASE='http://127.0.0.1:5001/demo-budgy/us-central1';
async function signUp(){const r=await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:`${randomUUID()}@example.test`,password:`Test!${randomUUID()}`,returnSecureToken:true})});const x=await r.json();assert.equal(r.status,200,JSON.stringify(x));return x;}
async function call(name,data,token){const r=await fetch(`${BASE}/${name}`,{method:'POST',headers:{'content-type':'application/json',...(token?{authorization:`Bearer ${token}`}:{})},body:JSON.stringify({data})});return {status:r.status,body:await r.json()};}
const create={requestId:'budgetCreate',budgetId:'groceries',name:'Groceries',categoryId:'food',limitCents:50000,frequency:'weekly'};
test('budget rules and initial calendar period lifecycle',async t=>{
 const app=initializeApp({projectId:'demo-budgy'},`budget-${randomUUID()}`);
 try{
  const alice=await signUp(),bob=await signUp();const db=getFirestore(app);const base=db.collection('users').doc(alice.localId);
  await t.test('auth required',async()=>{assert.equal((await call('createBudgetRule',create)).status,401)});
  await t.test('budget requires an actual active expense category',async()=>{assert.equal((await call('createBudgetRule',create,alice.idToken)).status,400)});
  await t.test('category exists',async()=>{const r=await call('createCategory',{requestId:'makeFood',categoryId:'food',type:'expense',name:'Food'},alice.idToken);assert.equal(r.status,200,JSON.stringify(r.body))});
  await t.test('creates budget and receipt',async()=>{const r=await call('createBudgetRule',create,alice.idToken);assert.equal(r.status,200,JSON.stringify(r.body));assert.equal((await base.collection('budgetRules').doc('groceries').get()).data().limitCents,50000)});
  await t.test('idempotent retry and conflicting request ID',async()=>{const replay=await call('createBudgetRule',create,alice.idToken);assert.equal(replay.status,200);assert.equal(replay.body.result.duplicate,true);assert.equal((await call('createBudgetRule',{...create,limitCents:1},alice.idToken)).status,409)});
  await t.test('opens weekly period without changing money',async()=>{const p={requestId:'open1',budgetId:'groceries',effectiveDate:'2026-11-06'};const r=await call('openBudgetPeriod',p,alice.idToken);assert.equal(r.status,200,JSON.stringify(r.body));assert.equal(r.body.result.startDate,'2026-11-02');assert.equal(r.body.result.endExclusiveDate,'2026-11-09');assert.equal((await base.collection('budgetPeriods').doc('groceries_2026-11-02').get()).data().spentCents,0);assert.equal((await call('openBudgetPeriod',p,alice.idToken)).body.result.duplicate,true)});
  await t.test('same period cannot be opened with different request ID',async()=>{assert.equal((await call('openBudgetPeriod',{requestId:'openAgain',budgetId:'groceries',effectiveDate:'2026-11-07'},alice.idToken)).status,409)});
  await t.test('updates future rule settings without rewriting open period',async()=>{const r=await call('updateBudgetRule',{requestId:'upd',budgetId:'groceries',name:'Groceries 2',categoryId:'food',limitCents:60000},alice.idToken);assert.equal(r.status,200,JSON.stringify(r.body));assert.equal((await base.collection('budgetPeriods').doc('groceries_2026-11-02').get()).data().limitCents,50000)});
  await t.test('pause prevents new periods',async()=>{assert.equal((await call('setBudgetPaused',{requestId:'pause1',budgetId:'groceries',paused:true},alice.idToken)).status,200);assert.equal((await call('openBudgetPeriod',{requestId:'openWhilePaused',budgetId:'groceries',effectiveDate:'2026-11-12'},alice.idToken)).status,400)});
  await t.test('another user cannot access or alter Alice budget',async()=>{assert.equal((await call('updateBudgetRule',{requestId:'hack',budgetId:'groceries',name:'Hacked',categoryId:'food',limitCents:1},bob.idToken)).status,404);assert.equal((await base.collection('budgetRules').doc('groceries').get()).data().name,'Groceries 2')});
  await t.test('rejects invalid amounts and frequencies',async()=>{for(const bad of [{...create,requestId:'bad1',budgetId:'x',limitCents:-1},{...create,requestId:'bad2',budgetId:'y',frequency:'daily'}])assert.equal((await call('createBudgetRule',bad,alice.idToken)).status,400)});
 }finally{await deleteApp(app)}
});

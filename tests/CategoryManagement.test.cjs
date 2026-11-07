'use strict';
// Emulator-only; start auth, firestore, functions with project demo-budgy first.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { createRequire } = require('node:module');
const path = require('node:path');
const fromFunctions = createRequire(path.resolve(__dirname, '../functions/package.json'));
const { initializeApp, deleteApp } = fromFunctions('firebase-admin/app');
const { getFirestore } = fromFunctions('firebase-admin/firestore');
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.GCLOUD_PROJECT = 'demo-budgy';
const BASE = 'http://127.0.0.1:5001/demo-budgy/us-central1';
async function signUp() {
  const r = await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: `${randomUUID()}@example.test`, password: `Test!${randomUUID()}`, returnSecureToken: true }),
  });
  const body = await r.json();
  assert.equal(r.status, 200, JSON.stringify(body));
  return body;
}
async function call(name, data, token) {
  const r = await fetch(`${BASE}/${name}`, {
    method: 'POST', headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ data }),
  });
  return { status: r.status, body: await r.json() };
}

test('categories: secure create, rename, archive, history preservation and retries', async (t) => {
  const app = initializeApp({ projectId: 'demo-budgy' }, `categories-${randomUUID()}`);
  try {
    const db = getFirestore(app);
    const alice = await signUp();
    const bob = await signUp();
    const categoryRef = db.collection('users').doc(alice.localId).collection('categories').doc('food');
    const create = { requestId: 'create_food', categoryId: 'food', name: '  Groceries  ', type: 'expense' };
    await t.test('requires authentication', async () => {
      const r = await call('createCategory', create);
      assert.equal(r.status, 401, JSON.stringify(r.body));
    });
    await t.test('creates normalized user-owned category with receipt', async () => {
      const r = await call('createCategory', create, alice.idToken);
      assert.equal(r.status, 200, JSON.stringify(r.body));
      assert.equal(r.body.result.name, 'Groceries');
      assert.equal((await categoryRef.get()).data().type, 'expense');
      const receipt = await db.collection('users').doc(alice.localId).collection('operations').doc('create_food').get();
      assert.equal(receipt.data().status, 'committed');
    });
    await t.test('identical create replay does not mutate data', async () => {
      const r = await call('createCategory', create, alice.idToken);
      assert.equal(r.status, 200, JSON.stringify(r.body));
      assert.equal(r.body.result.duplicate, true);
    });
    await t.test('conflicting retries and ID collision reject', async () => {
      for (const changed of [{ ...create, name: 'Gas' }, { ...create, requestId: 'create_food2' }]) {
        const r = await call('createCategory', changed, alice.idToken);
        assert.equal(r.status, 409, JSON.stringify(r.body));
      }
    });
    await t.test('renames without changing category ID or type', async () => {
      const r = await call('updateCategory', { requestId: 'rename_food', categoryId: 'food', name: 'Food & Drink' }, alice.idToken);
      assert.equal(r.status, 200, JSON.stringify(r.body));
      assert.equal((await categoryRef.get()).data().name, 'Food & Drink');
      assert.equal((await categoryRef.get()).data().type, 'expense');
    });
    await t.test('archives category without deleting historical data', async () => {
      const r = await call('archiveCategory', { requestId: 'archive_food', categoryId: 'food' }, alice.idToken);
      assert.equal(r.status, 200, JSON.stringify(r.body));
      assert.equal((await categoryRef.get()).data().archived, true);
      const replay = await call('archiveCategory', { requestId: 'archive_food', categoryId: 'food' }, alice.idToken);
      assert.equal(replay.body.result.duplicate, true);
    });
    await t.test('archived categories cannot be edited', async () => {
      const r = await call('updateCategory', { requestId: 'rename_archived', categoryId: 'food', name: 'New Name' }, alice.idToken);
      assert.equal(r.status, 400, JSON.stringify(r.body));
    });
    await t.test('rejects invalid inputs', async () => {
      for (const data of [
        { ...create, requestId: 'bad_type', categoryId: 'bad_type', type: 'other' },
        { ...create, requestId: 'bad_name', categoryId: 'bad_name', name: '  ' },
        { ...create, requestId: 'bad_id', categoryId: 'bad/id' },
        { ...create, requestId: 'extra_field', categoryId: 'extra', amountCents: 999 },
      ]) {
        const r = await call('createCategory', data, alice.idToken);
        assert.equal(r.status, 400, JSON.stringify(r.body));
      }
    });
    await t.test('cross-user category paths are not writable via caller data', async () => {
      const r = await call('createCategory', { requestId: 'bob_try', categoryId: 'food', name: 'Attempt', type: 'expense', uid: alice.localId }, bob.idToken);
      assert.equal(r.status, 400, JSON.stringify(r.body));
      assert.equal((await categoryRef.get()).data().name, 'Food & Drink');
    });
    await t.test('another user can create their own category with same ID', async () => {
      const r = await call('createCategory', { ...create, requestId: 'bob_own' }, bob.idToken);
      assert.equal(r.status, 200, JSON.stringify(r.body));
      const doc = await db.collection('users').doc(bob.localId).collection('categories').doc('food').get();
      assert.equal(doc.data().name, 'Groceries');
    });
  } finally { await deleteApp(app); }
});

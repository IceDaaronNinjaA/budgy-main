'use strict';
// Emulator-only; start auth, firestore, functions under demo-budgy first.
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
    method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ data }),
  });
  return { status: r.status, body: await r.json() };
}
function input(requestId, amountCents, extra = {}) {
  return { requestId, amountCents, effectiveDate: '2026-11-06', ...extra };
}
test('income and expense metadata persist and participate in idempotency', async (t) => {
  const app = initializeApp({ projectId: 'demo-budgy' }, `metadata-${randomUUID()}`);
  try {
    const db = getFirestore(app);
    const user = await signUp();
    const base = db.collection('users').doc(user.localId);
    const opening = await call('initializeAccount', input('opening_meta', 100000), user.idToken);
    assert.equal(opening.status, 200, JSON.stringify(opening.body));
    const income = input('income_meta', 50000, { description: '  Paycheck  ', categoryId: 'salary' });
    await t.test('income stores normalized description and category', async () => {
      const r = await call('recordIncome', income, user.idToken);
      assert.equal(r.status, 200, JSON.stringify(r.body));
      const doc = await base.collection('transactions').doc('income_income_meta').get();
      assert.equal(doc.data().description, 'Paycheck');
      assert.equal(doc.data().categoryId, 'salary');
      const event = await base.collection('journal').doc('income_income_meta').get();
      assert.equal(event.data().description, 'Paycheck');
    });
    await t.test('retry with identical metadata is idempotent', async () => {
      const r = await call('recordIncome', income, user.idToken);
      assert.equal(r.status, 200, JSON.stringify(r.body));
      assert.equal(r.body.result.duplicate, true);
    });
    await t.test('reusing request ID with changed metadata is rejected', async () => {
      const r = await call('recordIncome', { ...income, description: 'Different' }, user.idToken);
      assert.equal(r.status, 409, JSON.stringify(r.body));
    });
    await t.test('expense stores description and category', async () => {
      const r = await call('recordExpense', input('expense_meta', 1250, {
        description: 'Groceries', categoryId: 'food', sourceKey: 'unallocated',
      }), user.idToken);
      assert.equal(r.status, 200, JSON.stringify(r.body));
      const doc = await base.collection('transactions').doc('expense_expense_meta').get();
      assert.equal(doc.data().description, 'Groceries');
      assert.equal(doc.data().categoryId, 'food');
      assert.equal(doc.data().sourceKey, 'unallocated');
      assert.equal(r.body.result.trackedTotalCents, 148750);
    });
    await t.test('invalid descriptions and category IDs are rejected', async () => {
      for (const [extra, tag] of [
        [{ description: '  ' }, 'blank'],
        [{ description: 'x'.repeat(201) }, 'long'],
        [{ categoryId: 'not/allowed' }, 'category'],
        [{ categoryId: 123 }, 'type'],
      ]) {
        const r = await call('recordIncome', input(`bad_meta_${tag}`, 100, extra), user.idToken);
        assert.equal(r.status, 400, JSON.stringify({ extra, body: r.body }));
      }
    });
    await t.test('legacy income calls without metadata remain supported', async () => {
      const r = await call('recordIncome', input('legacy_meta', 100), user.idToken);
      assert.equal(r.status, 200, JSON.stringify(r.body));
      const doc = await base.collection('transactions').doc('income_legacy_meta').get();
      assert.equal(doc.data().description, '');
      assert.equal(doc.data().categoryId, null);
    });
  } finally { await deleteApp(app); }
});

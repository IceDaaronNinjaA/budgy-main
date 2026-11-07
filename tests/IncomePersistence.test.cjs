'use strict';
// Emulator-only; run with auth, firestore and functions emulators on demo-budgy.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { createRequire } = require('node:module');
const path = require('node:path');
const requireFromFunctions = createRequire(path.resolve(__dirname, '../functions/package.json'));
const { initializeApp, deleteApp } = requireFromFunctions('firebase-admin/app');
const { getFirestore } = requireFromFunctions('firebase-admin/firestore');
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.GCLOUD_PROJECT = 'demo-budgy';
const BASE = 'http://127.0.0.1:5001/demo-budgy/us-central1';

async function signUp() {
  const response = await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: `${randomUUID()}@example.test`, password: `Test!${randomUUID()}`, returnSecureToken: true }),
  });
  const data = await response.json();
  assert.equal(response.status, 200, JSON.stringify(data));
  return data;
}
async function call(name, data, token) {
  const response = await fetch(`${BASE}/${name}`, {
    method: 'POST', headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ data }),
  });
  return { status: response.status, body: await response.json() };
}
const input = (requestId, amountCents) => ({ requestId, amountCents, effectiveDate: '2026-11-06' });

test('recordIncome: authentication, persistence, replay, concurrent updates', async (t) => {
  const app = initializeApp({ projectId: 'demo-budgy' }, `income-${randomUUID()}`);
  try {
    const db = getFirestore(app);
    const user = await signUp();
    const base = db.collection('users').doc(user.localId);
    await t.test('cannot record income before opening an account', async () => {
      const r = await call('recordIncome', input('early', 100), user.idToken);
      assert.equal(r.status, 400, JSON.stringify(r.body));
    });
    await t.test('rejects unauthenticated income', async () => {
      const r = await call('recordIncome', input('unauthenticated', 100));
      assert.equal(r.status, 401, JSON.stringify(r.body));
    });
    await t.test('initializes account', async () => {
      const r = await call('initializeAccount', input('opening1', 150000), user.idToken);
      assert.equal(r.status, 200, JSON.stringify(r.body));
    });
    await t.test('income commits journal, receipt, transaction, and updated summary', async () => {
      const r = await call('recordIncome', input('paycheck1', 75000), user.idToken);
      assert.equal(r.status, 200, JSON.stringify(r.body));
      assert.equal(r.body.result.trackedTotalCents, 225000);
      assert.equal(r.body.result.unallocatedCents, 225000);
      const [journal, receipt, transaction, summary] = await Promise.all([
        base.collection('journal').doc('income_paycheck1').get(),
        base.collection('operations').doc('paycheck1').get(),
        base.collection('transactions').doc('income_paycheck1').get(),
        base.collection('summaries').doc('current').get(),
      ]);
      assert.equal(journal.exists, true);
      assert.equal(receipt.data().status, 'committed');
      assert.equal(transaction.data().amountCents, 75000);
      assert.equal(summary.data().trackedTotalCents, 225000);
      assert.deepEqual(journal.data().postings, [
        { accountKey: 'external', deltaCents: -75000 },
        { accountKey: 'unallocated', deltaCents: 75000 },
      ]);
    });
    await t.test('identical income replay returns duplicate, without changing balance', async () => {
      const r = await call('recordIncome', input('paycheck1', 75000), user.idToken);
      assert.equal(r.status, 200, JSON.stringify(r.body));
      assert.equal(r.body.result.duplicate, true);
      assert.equal((await base.collection('summaries').doc('current').get()).data().trackedTotalCents, 225000);
    });
    await t.test('conflicting request ID is rejected', async () => {
      const r = await call('recordIncome', input('paycheck1', 1), user.idToken);
      assert.equal(r.status, 409, JSON.stringify(r.body));
    });
    await t.test('two simultaneous distinct incomes do not lose an update', async () => {
      const results = await Promise.all([
        call('recordIncome', input('simultaneousA', 1000), user.idToken),
        call('recordIncome', input('simultaneousB', 2000), user.idToken),
      ]);
      for (const r of results) assert.equal(r.status, 200, JSON.stringify(r.body));
      assert.equal((await base.collection('summaries').doc('current').get()).data().trackedTotalCents, 228000);
    });
    await t.test('zero and malformed income amounts are rejected', async () => {
      for (const amount of [0, -1, 1.5, '100']) {
        const r = await call('recordIncome', input(`invalid${String(amount).replace(/[^a-z0-9]/gi, '_')}`, amount), user.idToken);
        assert.equal(r.status, 400, JSON.stringify(r.body));
      }
    });
  } finally {
    await deleteApp(app);
  }
});

'use strict';
// Run with demo-budgy Auth, Firestore, and Functions emulators active.
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
async function signup() {
  const r = await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: `${randomUUID()}@example.test`, password: `Test!${randomUUID()}`, returnSecureToken: true }),
  });
  const x = await r.json(); assert.equal(r.status, 200, JSON.stringify(x)); return x;
}
async function call(name, data, token) {
  const r = await fetch(`${BASE}/${name}`, { method: 'POST', headers: {
    'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}),
  }, body: JSON.stringify({ data }) });
  return { status: r.status, body: await r.json() };
}
function ok(response) { assert.equal(response.status, 200, JSON.stringify(response.body)); return response.body.result; }
const date = '2026-10-15';
const periodId = 'grocery_2026-10-01';
const money = (requestId, amountCents, extras = {}) => ({ requestId, amountCents, effectiveDate: date, ...extras });

test('period-aware corrections preserve ledger, audit and budget variance', async (t) => {
  const app = initializeApp({ projectId: 'demo-budgy' }, `linked-corrections-${randomUUID()}`);
  try {
    const alice = await signup(); const bob = await signup(); const auth = alice.idToken;
    const base = getFirestore(app).collection('users').doc(alice.localId);
    const period = async () => (await base.collection('budgetPeriods').doc(periodId).get()).data();
    const summary = async () => (await base.collection('summaries').doc('current').get()).data();
    const original = money('purchase', 10000, { sourceKey: 'budget:grocery', budgetPeriodId: periodId, categoryId: 'food' });
    await t.test('create budget and original linked expense', async () => {
      ok(await call('initializeAccount', money('start', 100000), auth));
      ok(await call('createCategory', { requestId: 'cat', categoryId: 'food', name: 'Food', type: 'expense' }, auth));
      ok(await call('createBudgetRule', { requestId: 'rule', budgetId: 'grocery', name: 'Groceries', categoryId: 'food', limitCents: 20000, frequency: 'monthly' }, auth));
      ok(await call('openBudgetPeriod', { requestId: 'period', budgetId: 'grocery', effectiveDate: date }, auth));
      ok(await call('allocateFunds', money('fund', 15000, { destinationKey: 'budget:grocery' }), auth));
      ok(await call('recordExpense', original, auth));
      assert.equal((await period()).spentCents, 10000);
      assert.equal((await summary()).accounts['budget:grocery'], 5000);
    });
    const correction = { requestId: 'fix', transactionId: 'expense_purchase', amountCents: 1000, effectiveDate: date, description: 'Corrected amount' };
    await t.test('correction atomically changes spending and funds', async () => {
      ok(await call('correctTransaction', correction, auth));
      assert.equal((await period()).spentCents, 1000);
      assert.equal((await period()).varianceCents, 19000);
      assert.equal((await summary()).trackedTotalCents, 99000);
      assert.equal((await summary()).accounts['budget:grocery'], 14000);
      assert.equal((await base.collection('transactions').doc('corrected_fix').get()).data().budgetPeriodId, periodId);
      assert.equal((await base.collection('journal').doc('reversal_fix').get()).data().budgetPeriodId, periodId);
    });
    await t.test('replay does not adjust spending twice', async () => {
      assert.equal(ok(await call('correctTransaction', correction, auth)).duplicate, true);
      assert.equal((await period()).spentCents, 1000);
    });
    await t.test('reverse linked corrected expense', async () => {
      ok(await call('reverseTransaction', { requestId: 'cancelFix', transactionId: 'corrected_fix' }, auth));
      assert.equal((await period()).spentCents, 0);
      assert.equal((await period()).varianceCents, 20000);
      assert.equal((await summary()).trackedTotalCents, 100000);
      assert.equal((await summary()).accounts['budget:grocery'], 15000);
    });
    await t.test('cannot double reverse original', async () => {
      const r = await call('reverseTransaction', { requestId: 'double', transactionId: 'expense_purchase' }, auth);
      assert.equal(r.status, 400, JSON.stringify(r.body));
    });
    await t.test('invalid source and out-of-period date reject atomically', async () => {
      ok(await call('recordExpense', money('another', 2000, { sourceKey: 'budget:grocery', budgetPeriodId: periodId, categoryId: 'food' }), auth));
      for (const bad of [
        { requestId: 'wrongSource', transactionId: 'expense_another', amountCents: 500, effectiveDate: date, sourceKey: 'unallocated' },
        { requestId: 'wrongDate', transactionId: 'expense_another', amountCents: 500, effectiveDate: '2026-11-01' },
      ]) assert.equal((await call('correctTransaction', bad, auth)).status, 400);
      assert.equal((await period()).spentCents, 2000);
    });
    await t.test('cannot reverse another user transaction', async () => {
      const r = await call('reverseTransaction', { requestId: 'bob', transactionId: 'expense_another' }, bob.idToken);
      assert.equal(r.status, 404, JSON.stringify(r.body));
    });
    await t.test('closed periods cannot be corrected, history stays intact', async () => {
      ok(await call('closeBudgetPeriod', { requestId: 'close', budgetId: 'grocery', periodId }, auth));
      assert.equal((await call('reverseTransaction', { requestId: 'lateReverse', transactionId: 'expense_another' }, auth)).status, 400);
      assert.equal((await period()).spentCents, 2000);
      assert.equal((await period()).status, 'closed');
    });
  } finally { await deleteApp(app); }
});

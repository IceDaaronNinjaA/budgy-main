'use strict';
// Emulator integration tests; only run against local demo-budgy emulators.
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
    method: 'POST', headers: { 'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ data }),
  });
  return { status: r.status, body: await r.json() };
}
function success(r) {
  assert.equal(r.status, 200, JSON.stringify(r.body));
  return r.body.result;
}
const input = (requestId, amountCents, extra = {}) =>
  ({ requestId, amountCents, effectiveDate: '2026-11-06', ...extra });

test('transaction corrections and reversals preserve audit trail and money', async (t) => {
  const app = initializeApp({ projectId: 'demo-budgy' }, `correction-${randomUUID()}`);
  try {
    const db = getFirestore(app);
    const alice = await signUp();
    const bob = await signUp();
    const base = db.collection('users').doc(alice.localId);
    const summary = async () => (await base.collection('summaries').doc('current').get()).data();
    const token = alice.idToken;

    await t.test('rejects unauthenticated correction', async () => {
      assert.equal((await call('reverseTransaction', { requestId: 'noauth', transactionId: 'expense_ghost' })).status, 401);
    });
    success(await call('initializeAccount', input('opening_correction', 100000), token));
    success(await call('allocateFunds', input('foodFund', 20000, { destinationKey: 'budget:food' }), token));
    success(await call('recordExpense', input('wrongFood', 10000, {
      sourceKey: 'budget:food', description: 'Wrong amount', categoryId: 'food',
    }), token));

    await t.test('corrects $100 budget expense to $10 atomically', async () => {
      const result = success(await call('correctTransaction', {
        requestId: 'correctFood', transactionId: 'expense_wrongFood', amountCents: 1000,
        effectiveDate: '2026-11-06', description: 'Actual purchase', categoryId: 'food',
      }, token));
      assert.equal(result.trackedTotalCents, 99000);
      const s = await summary();
      assert.equal(s.accounts['budget:food'], 19000);
      assert.equal(s.unallocatedCents, 80000);
      const oldTxn = (await base.collection('transactions').doc('expense_wrongFood').get()).data();
      const newTxn = (await base.collection('transactions').doc('corrected_correctFood').get()).data();
      const reversal = (await base.collection('journal').doc('reversal_correctFood').get()).data();
      const oldEvent = (await base.collection('journal').doc('expense_wrongFood').get()).data();
      assert.equal(oldTxn.status, 'reversed');
      assert.equal(oldTxn.replacedByTransactionId, 'corrected_correctFood');
      assert.equal(newTxn.description, 'Actual purchase');
      assert.equal(newTxn.correctsTransactionId, 'expense_wrongFood');
      assert.equal(reversal.reversesEventId, 'expense_wrongFood');
      assert.deepEqual(reversal.postings, oldEvent.postings.map(({ accountKey, deltaCents }) =>
        ({ accountKey, deltaCents: -deltaCents })));
    });
    await t.test('duplicate correction does not post twice', async () => {
      const r = success(await call('correctTransaction', {
        requestId: 'correctFood', transactionId: 'expense_wrongFood', amountCents: 1000,
        effectiveDate: '2026-11-06', description: 'Actual purchase', categoryId: 'food',
      }, token));
      assert.equal(r.duplicate, true);
      assert.equal((await summary()).trackedTotalCents, 99000);
    });
    await t.test('conflicting correction and second correction are rejected', async () => {
      assert.equal((await call('correctTransaction', {
        requestId: 'correctFood', transactionId: 'expense_wrongFood', amountCents: 2000,
        effectiveDate: '2026-11-06',
      }, token)).status, 409);
      assert.equal((await call('reverseTransaction', {
        requestId: 'anotherFood', transactionId: 'expense_wrongFood',
      }, token)).status, 400);
    });
    await t.test('reverse income after spending can leave unallocated negative', async () => {
      success(await call('recordIncome', input('mistakeIncome', 500, { description: 'Incorrect deposit' }), token));
      const result = success(await call('reverseTransaction', {
        requestId: 'undoIncome', transactionId: 'income_mistakeIncome',
      }, token));
      assert.equal(result.trackedTotalCents, 99000);
      assert.equal(success(await call('reverseTransaction', {
        requestId: 'undoIncome', transactionId: 'income_mistakeIncome',
      }, token)).duplicate, true);
    });
    await t.test('reverse an expense restores the original reserve and balance', async () => {
      success(await call('recordExpense', input('undoable', 3000, { sourceKey: 'budget:food' }), token));
      const undone = success(await call('reverseTransaction', {
        requestId: 'undoExpense', transactionId: 'expense_undoable',
      }, token));
      assert.equal(undone.trackedTotalCents, 99000);
      assert.equal((await summary()).accounts['budget:food'], 19000);
    });
    await t.test('failed replacement does not leave partial reversal', async () => {
      success(await call('recordExpense', input('goalPurchase', 500, { sourceKey: 'unallocated' }), token));
      const before = await summary();
      const result = await call('correctTransaction', {
        requestId: 'badGoalCorrection', transactionId: 'expense_goalPurchase',
        amountCents: 500000, effectiveDate: '2026-11-06', sourceKey: 'goal:empty',
      }, token);
      assert.notEqual(result.status, 200);
      assert.equal((await summary()).trackedTotalCents, before.trackedTotalCents);
      assert.equal((await base.collection('journal').doc('reversal_badGoalCorrection').get()).exists, false);
      assert.notEqual((await base.collection('transactions').doc('expense_goalPurchase').get()).data().status, 'reversed');
    });
    await t.test('cross-user transaction is inaccessible', async () => {
      success(await call('initializeAccount', input('bobOpeningCorrection', 1000), bob.idToken));
      assert.equal((await call('reverseTransaction', {
        requestId: 'bobSteal', transactionId: 'expense_wrongFood',
      }, bob.idToken)).status, 404);
    });
    await t.test('invalid and nonexistent target rejected', async () => {
      assert.equal((await call('reverseTransaction', { requestId: 'badInput', transactionId: 'invalid/name' }, token)).status, 400);
      assert.equal((await call('reverseTransaction', { requestId: 'notFound', transactionId: 'income_missing' }, token)).status, 404);
    });
  } finally { await deleteApp(app); }
});

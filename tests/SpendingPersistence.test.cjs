'use strict';
// Integration tests; ONLY demo-budgy emulators. Start auth, firestore, functions first.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { createRequire } = require('node:module');
const path = require('node:path');
const functionsRequire = createRequire(path.resolve(__dirname, '../functions/package.json'));
const { initializeApp, deleteApp } = functionsRequire('firebase-admin/app');
const { getFirestore } = functionsRequire('firebase-admin/firestore');
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.GCLOUD_PROJECT = 'demo-budgy';
const BASE = 'http://127.0.0.1:5001/demo-budgy/us-central1';

async function signUp() {
  const r = await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: `${randomUUID()}@example.test`, password: `Test!${randomUUID()}`, returnSecureToken: true }),
  });
  const result = await r.json();
  assert.equal(r.status, 200, JSON.stringify(result));
  return result;
}
async function call(name, data, token) {
  const response = await fetch(`${BASE}/${name}`, {
    method: 'POST', headers: { 'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ data }),
  });
  return { status: response.status, body: await response.json() };
}
function cmd(requestId, amountCents, other = {}) {
  return { requestId, amountCents, effectiveDate: '2026-11-06', ...other };
}
function success(response) {
  assert.equal(response.status, 200, JSON.stringify(response.body));
  return response.body.result;
}

// New account per run makes tests safe to rerun without clearing the emulator.
test('expenses and reserve operations are authenticated, atomic and idempotent', async (t) => {
  const app = initializeApp({ projectId: 'demo-budgy' }, `spending-${randomUUID()}`);
  try {
    const db = getFirestore(app);
    const alice = await signUp();
    const bob = await signUp();
    const base = db.collection('users').doc(alice.localId);
    const current = () => base.collection('summaries').doc('current').get().then((s) => s.data());
    const auth = alice.idToken;

    await t.test('rejects unauthenticated allocation', async () => {
      assert.equal((await call('allocateFunds', cmd('noauth', 50000, { destinationKey: 'budget:groceries' }))).status, 401);
    });
    await t.test('rejects financial operations before initialization', async () => {
      assert.equal((await call('allocateFunds', cmd('beforeOpening', 100, { destinationKey: 'budget:groceries' }), auth)).status, 400);
    });
    await t.test('initializes $2250', async () => {
      const result = success(await call('initializeAccount', cmd('openingSpend', 225000), auth));
      assert.equal(result.trackedTotalCents, 225000);
    });
    await t.test('allocate $500 to groceries without reducing total', async () => {
      const result = success(await call('allocateFunds', cmd('groceryAllocation', 50000, { destinationKey: 'budget:groceries' }), auth));
      assert.equal(result.trackedTotalCents, 225000);
      assert.equal(result.unallocatedCents, 175000);
      const data = await current();
      assert.equal(data.accounts['budget:groceries'], 50000);
      assert.equal(data.budgetReserveCents, 50000);
    });
    await t.test('spend $75 from groceries; journal and transaction persist', async () => {
      const result = success(await call('recordExpense', cmd('grocery75', 7500, { sourceKey: 'budget:groceries' }), auth));
      assert.equal(result.trackedTotalCents, 217500);
      assert.equal(result.unallocatedCents, 175000);
      const [state, transaction, journal, receipt] = await Promise.all([
        current(), base.collection('transactions').doc('expense_grocery75').get(),
        base.collection('journal').doc('expense_grocery75').get(),
        base.collection('operations').doc('grocery75').get(),
      ]);
      assert.equal(state.accounts['budget:groceries'], 42500);
      assert.equal(transaction.data().sourceKey, 'budget:groceries');
      assert.equal(journal.data().postings.reduce((sum, p) => sum + p.deltaCents, 0), 0);
      assert.equal(receipt.data().status, 'committed');
    });
    await t.test('replays cannot spend twice; changed amount or source rejects', async () => {
      assert.equal(success(await call('recordExpense', cmd('grocery75', 7500, { sourceKey: 'budget:groceries' }), auth)).duplicate, true);
      assert.equal((await call('recordExpense', cmd('grocery75', 100, { sourceKey: 'budget:groceries' }), auth)).status, 409);
      assert.equal((await call('recordExpense', cmd('grocery75', 7500, { sourceKey: 'unallocated' }), auth)).status, 409);
      assert.equal((await current()).trackedTotalCents, 217500);
    });
    await t.test('budget overspend uses unallocated but cannot invent money', async () => {
      success(await call('recordExpense', cmd('groceryOverspend', 50000, { sourceKey: 'budget:groceries' }), auth));
      const data = await current();
      assert.equal(data.accounts['budget:groceries'], 0);
      assert.equal(data.unallocatedCents, 167500); // 42500 reserve, 7500 unallocated
      assert.equal(data.trackedTotalCents, 167500);
    });
    await t.test('release and transfer preserve total', async () => {
      success(await call('allocateFunds', cmd('goalFunding', 20000, { destinationKey: 'goal:emergency' }), auth));
      success(await call('transferFunds', cmd('goalToBills', 5000, { sourceKey: 'goal:emergency', destinationKey: 'bill:rent' }), auth));
      success(await call('releaseFunds', cmd('releaseBills', 2000, { sourceKey: 'bill:rent' }), auth));
      const data = await current();
      assert.equal(data.trackedTotalCents, 167500);
      assert.equal(data.accounts['goal:emergency'], 15000);
      assert.equal(data.accounts['bill:rent'], 3000);
      assert.equal(data.unallocatedCents, 149500);
    });
    await t.test('reserve cannot be overspent; invalid allocations are rejected', async () => {
      for (const [name, input] of [
        ['recordExpense', cmd('badGoalSpend', 20000, { sourceKey: 'goal:emergency' })],
        ['releaseFunds', cmd('badRelease', 5000, { sourceKey: 'bill:rent' })],
        ['transferFunds', cmd('badTransfer', 500000, { sourceKey: 'unallocated', destinationKey: 'goal:other' })],
        ['allocateFunds', cmd('badAllocation', 500000, { destinationKey: 'budget:other' })],
        ['allocateFunds', cmd('badDestination', 100, { destinationKey: 'external' })],
      ]) {
        const r = await call(name, input, auth);
        assert.notEqual(r.status, 200, `${name} unexpectedly succeeded: ${JSON.stringify(r.body)}`);
      }
      assert.equal((await current()).trackedTotalCents, 167500);
    });
    await t.test('unallocated spending can show an honest negative balance', async () => {
      success(await call('recordExpense', cmd('unallocatedOverdraft', 150000, { sourceKey: 'unallocated' }), auth));
      const data = await current();
      assert.equal(data.unallocatedCents, -500);
      assert.equal(data.trackedTotalCents, 17500);
    });
    await t.test('concurrent distinct expenses do not lose updates', async () => {
      const results = await Promise.all([
        call('recordExpense', cmd('concurrentExpenseA', 100, { sourceKey: 'unallocated' }), auth),
        call('recordExpense', cmd('concurrentExpenseB', 200, { sourceKey: 'unallocated' }), auth),
      ]);
      results.forEach(success);
      assert.equal((await current()).trackedTotalCents, 17200);
    });
    await t.test('another user cannot mutate Alice balances via supplied UID', async () => {
      success(await call('initializeAccount', cmd('bobOpening', 1000), bob.idToken));
      const r = await call('recordExpense', cmd('bobExpense', 100, { sourceKey: 'unallocated', uid: alice.localId }), bob.idToken);
      assert.equal(r.status, 400); // unexpected uid rejected
      assert.equal((await current()).trackedTotalCents, 17200);
      assert.equal((await db.doc(`users/${bob.localId}/summaries/current`).get()).data().trackedTotalCents, 1000);
    });
  } finally {
    await deleteApp(app);
  }
});

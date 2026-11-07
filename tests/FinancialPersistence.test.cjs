'use strict';

// Emulator-only integration tests for Budgy's initializeAccount callable.
// Requires: npx firebase-tools emulators:start --only auth,firestore,functions --project demo-budgy
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const functionsRequire = createRequire(path.resolve(__dirname, '../functions/package.json'));
const { initializeApp, deleteApp } = functionsRequire('firebase-admin/app');
const { getFirestore } = functionsRequire('firebase-admin/firestore');

const projectId = 'demo-budgy';
const authBase = 'http://127.0.0.1:9099';
const functionsBase = `http://127.0.0.1:5001/${projectId}/us-central1`;

// The Admin SDK below must talk ONLY to the local emulator.
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.GCLOUD_PROJECT = projectId;

async function signUpUser() {
  const email = `budgy-test-${randomUUID()}@example.test`;
  const response = await fetch(`${authBase}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: `Test!${randomUUID()}`, returnSecureToken: true }),
  });
  const body = await response.json();
  assert.equal(response.status, 200, `Auth emulator signup failed: ${JSON.stringify(body)}`);
  assert.ok(body.localId && body.idToken);
  return { uid: body.localId, idToken: body.idToken };
}

async function call(name, data, idToken) {
  const response = await fetch(`${functionsBase}/${name}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(idToken ? { authorization: `Bearer ${idToken}` } : {}),
    },
    body: JSON.stringify({ data }),
  });
  return { status: response.status, body: await response.json() };
}

const request = { requestId: 'opening_001', amountCents: 150000, effectiveDate: '2026-11-06' };

test('initializeAccount: authenticated, atomic, idempotent, isolated', async (t) => {
  const app = initializeApp({ projectId }, `integration-${randomUUID()}`);
  try {
    const db = getFirestore(app);
    const alice = await signUpUser();
    const bob = await signUpUser();

    await t.test('unauthenticated requests are rejected', async () => {
      const res = await call('initializeAccount', request);
      assert.equal(res.status, 401, JSON.stringify(res.body));
    });

    await t.test('first request creates journal, receipt and correct balance', async () => {
      const res = await call('initializeAccount', request, alice.idToken);
      assert.equal(res.status, 200, JSON.stringify(res.body));
      assert.equal(res.body.result.duplicate, false);
      assert.equal(res.body.result.trackedTotalCents, 150000);
      assert.equal(res.body.result.unallocatedCents, 150000);

      const base = db.collection('users').doc(alice.uid);
      const [journal, operation, summary] = await Promise.all([
        base.collection('journal').doc('opening_opening_001').get(),
        base.collection('operations').doc('opening_001').get(),
        base.collection('summaries').doc('current').get(),
      ]);
      assert.equal(journal.exists, true);
      assert.equal(operation.exists, true);
      assert.equal(summary.exists, true);
      assert.equal(journal.data().eventType, 'opening_balance');
      assert.deepEqual(journal.data().postings, [
        { accountKey: 'external', deltaCents: -150000 },
        { accountKey: 'unallocated', deltaCents: 150000 },
      ]);
      assert.equal(operation.data().status, 'committed');
      assert.equal(summary.data().trackedTotalCents, 150000);
    });

    await t.test('identical replay does not add money', async () => {
      const replay = await call('initializeAccount', request, alice.idToken);
      assert.equal(replay.status, 200, JSON.stringify(replay.body));
      assert.equal(replay.body.result.duplicate, true);
      assert.equal(replay.body.result.trackedTotalCents, 150000);
      const journal = await db.collection('users').doc(alice.uid).collection('journal').get();
      assert.equal(journal.size, 1);
    });

    await t.test('changed payload with same requestId is rejected', async () => {
      const altered = await call('initializeAccount', { ...request, amountCents: 900000 }, alice.idToken);
      assert.equal(altered.status, 409, JSON.stringify(altered.body));
    });

    await t.test('second opening with different requestId is rejected', async () => {
      const second = await call('initializeAccount', { ...request, requestId: 'opening_002' }, alice.idToken);
      assert.equal(second.status, 400, JSON.stringify(second.body));
    });

    await t.test('different users maintain independent account balances', async () => {
      const result = await call('initializeAccount', { ...request, amountCents: 2500 }, bob.idToken);
      assert.equal(result.status, 200, JSON.stringify(result.body));
      const aliceSummary = await db.doc(`users/${alice.uid}/summaries/current`).get();
      const bobSummary = await db.doc(`users/${bob.uid}/summaries/current`).get();
      assert.equal(aliceSummary.data().trackedTotalCents, 150000);
      assert.equal(bobSummary.data().trackedTotalCents, 2500);
    });
  } finally {
    await deleteApp(app);
  }
});

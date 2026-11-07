'use strict';

const { test } = require('node:test');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} = require('@firebase/rules-unit-testing');
const {
  doc,
  getDoc,
  getDocs,
  collection,
  setDoc,
  updateDoc,
  deleteDoc,
} = require('firebase/firestore');

// Never connect these tests to a production project.
const PROJECT_ID = 'demo-budgy';
const HOST = '127.0.0.1';
const PORT = 8080;

// These tests use isolated, emulator-only test records; they do not clear
// the rest of the emulator database or create users in production Firebase.
test('Firestore security: owner reads, isolation, and deny-all client writes', async (t) => {
  const environment = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      host: HOST,
      port: PORT,
      rules: readFileSync(resolve(__dirname, '..', 'firestore.rules'), 'utf8'),
    },
  });

  t.after(async () => environment.cleanup());

  const alice = environment.authenticatedContext('security-test-alice').firestore();
  const bob = environment.authenticatedContext('security-test-bob').firestore();
  const guest = environment.unauthenticatedContext().firestore();

  const aliceProfile = 'users/security-test-alice';
  const bobProfile = 'users/security-test-bob';
  const aliceTxn = `${aliceProfile}/transactions/security-test-txn`;
  const bobTxn = `${bobProfile}/transactions/security-test-txn`;
  const aliceJournal = `${aliceProfile}/journal/security-test-event`;
  const legacyTxn = 'transactions/security-test-legacy';

  await environment.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await Promise.all([
      setDoc(doc(db, aliceProfile), { displayName: 'Test Alice' }),
      setDoc(doc(db, bobProfile), { displayName: 'Test Bob' }),
      setDoc(doc(db, aliceTxn), { amountCents: 10000 }),
      setDoc(doc(db, bobTxn), { amountCents: 5000 }),
      setDoc(doc(db, aliceJournal), { eventType: 'income' }),
      setDoc(doc(db, legacyTxn), { amount: 100 }),
    ]);
  });

  await t.test('Alice can read her own profile, transactions, and journal', async () => {
    await assertSucceeds(getDoc(doc(alice, aliceProfile)));
    await assertSucceeds(getDoc(doc(alice, aliceTxn)));
    await assertSucceeds(getDoc(doc(alice, aliceJournal)));
    await assertSucceeds(getDocs(collection(alice, `${aliceProfile}/transactions`)));
  });

  await t.test('Alice cannot read Bob, and Bob cannot read Alice', async () => {
    await assertFails(getDoc(doc(alice, bobProfile)));
    await assertFails(getDoc(doc(alice, bobTxn)));
    await assertFails(getDoc(doc(bob, aliceTxn)));
    await assertFails(getDocs(collection(bob, `${aliceProfile}/transactions`)));
  });

  await t.test('Unauthenticated clients cannot read financial data', async () => {
    await assertFails(getDoc(doc(guest, aliceProfile)));
    await assertFails(getDoc(doc(guest, aliceTxn)));
    await assertFails(getDocs(collection(guest, `${aliceProfile}/transactions`)));
  });

  await t.test('Clients cannot create, update, or delete financial records', async () => {
    await assertFails(setDoc(doc(alice, `${aliceProfile}/journal/security-test-new`), { amountCents: 42 }));
    await assertFails(updateDoc(doc(alice, aliceTxn), { amountCents: 1 }));
    await assertFails(deleteDoc(doc(alice, aliceTxn)));
    await assertFails(setDoc(doc(alice, `${aliceProfile}/transactions/security-test-new`), { amountCents: 42 }));
    await assertFails(setDoc(doc(alice, aliceProfile), { displayName: 'Modified' }));
  });

  await t.test('Legacy top-level collections remain inaccessible', async () => {
    await assertFails(getDoc(doc(alice, legacyTxn)));
    await assertFails(getDocs(collection(alice, 'transactions')));
    await assertFails(setDoc(doc(alice, 'transactions/security-test-new'), { amount: 1 }));
  });
});

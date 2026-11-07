'use strict';

// ============================================================
// Budgy - Recurring Bills Integration Tests
//
// Requires Firebase emulators:
//   Authentication: localhost:9099
//   Firestore:      localhost:8080
//   Functions:      localhost:5001
//
// Firebase project: demo-budgy
// ============================================================

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { createRequire } = require('node:module');
const path = require('node:path');

// Firebase Admin SDK from the functions directory.
const fns = createRequire(
  path.resolve(__dirname, '../functions/package.json')
);

const { initializeApp, deleteApp } = fns('firebase-admin/app');
const { getFirestore } = fns('firebase-admin/firestore');

// Emulator configuration.
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.GCLOUD_PROJECT = 'demo-budgy';

const BASE = 'http://127.0.0.1:5001/demo-budgy/us-central1';
const AUTH_BASE = 'http://127.0.0.1:9099';

// Default financial transaction date.
const date = '2026-10-15';

// ============================================================
// Test helpers
// ============================================================

// Register a unique temporary Firebase Auth user.
async function signup() {
  const response = await fetch(
    `${AUTH_BASE}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key`,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        email: `${randomUUID()}@example.test`,
        password: `Test!${randomUUID()}`,
        returnSecureToken: true,
      }),
    }
  );

  const result = await response.json();

  assert.equal(
    response.status,
    200,
    JSON.stringify(result)
  );

  return result;
}

// Invoke a Firebase callable Cloud Function.
async function call(name, data, token) {
  const response = await fetch(`${BASE}/${name}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token
        ? { authorization: `Bearer ${token}` }
        : {}),
    },
    body: JSON.stringify({ data }),
  });

  return {
    status: response.status,
    body: await response.json(),
  };
}

// Assert that a callable operation succeeded.
function ok(response) {
  assert.equal(
    response.status,
    200,
    JSON.stringify(response.body)
  );

  return response.body.result;
}

// Construct a standard financial operation.
function input(requestId, amountCents) {
  return {
    requestId,
    amountCents,
    effectiveDate: date,
  };
}

// Initial monthly rent configuration.
const rule = {
  requestId: 'rentCreate',
  billId: 'rent',
  name: 'Rent',
  amountCents: 50000,
  dayOfMonth: 31,
  categoryId: 'housing',
};

// ============================================================
// Recurring Bills Test Suite
// ============================================================

test(
  'recurring bills: month clamp, funding, confirmed expense, skip, isolation and retries',
  async (t) => {

    const app = initializeApp(
      { projectId: 'demo-budgy' },
      `bills-${randomUUID()}`
    );

    try {
      // Create two independent users.
      const alice = await signup();
      const bob = await signup();

      const auth = alice.idToken;

      // Alice's Firestore namespace.
      const base = getFirestore(app)
        .collection('users')
        .doc(alice.localId);

      // Retrieve Alice's current financial summary.
      const summary = async () => {
        const snapshot = await base
          .collection('summaries')
          .doc('current')
          .get();

        return snapshot.data();
      };

      // Retrieve one of Alice's bill occurrences.
      const occurrence = async (id) => {
        const snapshot = await base
          .collection('billOccurrences')
          .doc(id)
          .get();

        return snapshot.data();
      };

      // ------------------------------------------------------
      // 1. Authentication
      // ------------------------------------------------------

      await t.test('authentication required', async () => {
        const response = await call('createBillRule', rule);

        assert.equal(response.status, 401);
      });

      // ------------------------------------------------------
      // 2. Account initialization and category validation
      // ------------------------------------------------------

      await t.test(
        'requires initialized account and active expense category',
        async () => {

          // A user without initialized finances cannot create bills.
          const beforeInitialization = await call(
            'createBillRule',
            rule,
            auth
          );

          assert.equal(beforeInitialization.status, 400);

          // Initialize Alice with $1,000.
          ok(await call(
            'initializeAccount',
            input('opening', 100000),
            auth
          ));

          // The bill requires an existing expense category.
          const beforeCategory = await call(
            'createBillRule',
            rule,
            auth
          );

          assert.equal(beforeCategory.status, 400);

          // Create the required category.
          ok(await call(
            'createCategory',
            {
              requestId: 'cat',
              categoryId: 'housing',
              type: 'expense',
              name: 'Housing',
            },
            auth
          ));

          assert.equal(
            (await summary()).trackedTotalCents,
            100000
          );
        }
      );

      // ------------------------------------------------------
      // 3. Bill creation and idempotency
      // ------------------------------------------------------

      await t.test(
        'create rule and receipt are idempotent',
        async () => {

          ok(await call('createBillRule', rule, auth));

          // Identical request returns the previous result.
          const replay = ok(
            await call('createBillRule', rule, auth)
          );

          assert.equal(replay.duplicate, true);

          // Same request ID with different data must fail.
          const conflicting = await call(
            'createBillRule',
            {
              ...rule,
              amountCents: 20000,
            },
            auth
          );

          assert.equal(conflicting.status, 409);

          // Verify persisted amount.
          const snapshot = await base
            .collection('billRules')
            .doc('rent')
            .get();

          assert.equal(snapshot.exists, true);
          assert.equal(snapshot.data().amountCents, 50000);
        }
      );

      // ------------------------------------------------------
      // 4. Monthly recurrence and February date handling
      // ------------------------------------------------------

      await t.test(
        'open February occurrence with last-day clamp, not a payment',
        async () => {

          const command = {
            requestId: 'febOpen',
            billId: 'rent',
            month: '2027-02',
          };

          const result = ok(
            await call('openBillOccurrence', command, auth)
          );

          // February 2027 has only 28 days.
          assert.equal(result.dueDate, '2027-02-28');

          // Creating an occurrence must not pay the bill.
          assert.equal(result.status, 'unpaid');

          assert.equal(
            (await summary()).trackedTotalCents,
            100000
          );

          // Retry is safe.
          const replay = ok(
            await call('openBillOccurrence', command, auth)
          );

          assert.equal(replay.duplicate, true);

          // A second request cannot create the same occurrence.
          const duplicateOccurrence = await call(
            'openBillOccurrence',
            {
              requestId: 'febOther',
              billId: 'rent',
              month: '2027-02',
            },
            auth
          );

          assert.equal(duplicateOccurrence.status, 400);
        }
      );

      // ------------------------------------------------------
      // 5. Reserving money without creating an expense
      // ------------------------------------------------------

      await t.test(
        'reserve money without recording expense; refuse incomplete payment',
        async () => {

          const fundingCommand = {
            requestId: 'fundPartial',
            billId: 'rent',
            occurrenceId: 'rent_2027-02',
            amountCents: 20000,
            effectiveDate: date,
          };

          // Reserve $200.
          ok(await call(
            'fundBillOccurrence',
            fundingCommand,
            auth
          ));

          const state = await summary();

          // Funding is not spending.
          assert.equal(state.trackedTotalCents, 100000);

          // $200 is now reserved for rent.
          assert.equal(state.accounts['bill:rent'], 20000);

          // Cannot confirm payment without the full $500.
          const incompletePayment = await call(
            'confirmBillPayment',
            {
              requestId: 'payEarly',
              billId: 'rent',
              occurrenceId: 'rent_2027-02',
              effectiveDate: date,
            },
            auth
          );

          assert.equal(incompletePayment.status, 400);

          assert.equal(
            (await occurrence('rent_2027-02')).status,
            'unpaid'
          );

          // Cannot fund $400 more when only $300 remains due.
          const overfund = await call(
            'fundBillOccurrence',
            {
              requestId: 'overfund',
              billId: 'rent',
              occurrenceId: 'rent_2027-02',
              amountCents: 40000,
              effectiveDate: date,
            },
            auth
          );

          assert.equal(overfund.status, 400);

          // Replaying a funding request must not allocate twice.
          const replay = ok(
            await call(
              'fundBillOccurrence',
              fundingCommand,
              auth
            )
          );

          assert.equal(replay.duplicate, true);

          assert.equal(
            (await summary()).accounts['bill:rent'],
            20000
          );
        }
      );

      // ------------------------------------------------------
      // 6. Confirming a payment exactly once
      // ------------------------------------------------------

      await t.test(
        'pay exactly once, journal and transaction have occurrence linkage',
        async () => {

          // Fund the remaining $300.
          ok(await call(
            'fundBillOccurrence',
            {
              requestId: 'fundRemainder',
              billId: 'rent',
              occurrenceId: 'rent_2027-02',
              amountCents: 30000,
              effectiveDate: date,
            },
            auth
          ));

          const command = {
            requestId: 'payRent',
            billId: 'rent',
            occurrenceId: 'rent_2027-02',
            effectiveDate: '2027-02-28',
          };

          // Confirm actual payment.
          const result = ok(
            await call('confirmBillPayment', command, auth)
          );

          assert.equal(result.status, 'paid');

          const state = await summary();

          // $500 spent from original $1,000.
          assert.equal(state.trackedTotalCents, 50000);

          // Entire rent reserve consumed.
          assert.equal(state.accounts['bill:rent'], 0);

          assert.equal(
            (await occurrence('rent_2027-02')).status,
            'paid'
          );

          // Verify payment transaction.
          const transaction = await base
            .collection('transactions')
            .doc('bill_pay_payRent')
            .get();

          assert.equal(transaction.exists, true);

          assert.equal(
            transaction.data().billOccurrenceId,
            'rent_2027-02'
          );

          // Verify accounting journal.
          const journal = await base
            .collection('journal')
            .doc('bill_pay_payRent')
            .get();

          assert.equal(journal.exists, true);
          assert.equal(journal.data().eventType, 'expense');

          // Same payment request cannot spend money twice.
          const replay = ok(
            await call('confirmBillPayment', command, auth)
          );

          assert.equal(replay.duplicate, true);

          // Different request cannot pay an already-paid occurrence.
          const secondPayment = await call(
            'confirmBillPayment',
            {
              ...command,
              requestId: 'payRentAgain',
            },
            auth
          );

          assert.notEqual(secondPayment.status, 200);

          assert.equal(
            (await summary()).trackedTotalCents,
            50000
          );
        }
      );

      // ------------------------------------------------------
      // 7. Skipping an occurrence releases reserved money
      // ------------------------------------------------------

      await t.test(
        'skip next occurrence releases only reserved funds',
        async () => {

          // Create March occurrence.
          ok(await call(
            'openBillOccurrence',
            {
              requestId: 'marOpen',
              billId: 'rent',
              month: '2027-03',
            },
            auth
          ));

          // Reserve $150.
          ok(await call(
            'fundBillOccurrence',
            {
              requestId: 'marFund',
              billId: 'rent',
              occurrenceId: 'rent_2027-03',
              amountCents: 15000,
              effectiveDate: '2027-03-01',
            },
            auth
          ));

          // Skip this month.
          const skipCommand = {
            requestId: 'marSkip',
            billId: 'rent',
            occurrenceId: 'rent_2027-03',
            effectiveDate: '2027-03-31',
          };

          const result = ok(
            await call('skipBillOccurrence', skipCommand, auth)
          );

          // Reserved money returns to unallocated funds.
          assert.equal(result.releasedCents, 15000);

          assert.equal(
            (await occurrence('rent_2027-03')).status,
            'skipped'
          );

          // Skipping isn't an expense.
          const state = await summary();

          assert.equal(state.trackedTotalCents, 50000);
          assert.equal(state.accounts['bill:rent'], 0);

          // Replaying skip must not release funds twice.
          const replay = ok(
            await call('skipBillOccurrence', skipCommand, auth)
          );

          assert.equal(replay.duplicate, true);
        }
      );

      // ------------------------------------------------------
      // 8. Pausing and updating recurrence rules
      // ------------------------------------------------------

      await t.test('pause and update prospectively', async () => {

        // Pause rent.
        ok(await call(
          'setBillPaused',
          {
            requestId: 'pause',
            billId: 'rent',
            paused: true,
          },
          auth
        ));

        // Cannot open a new occurrence while paused.
        const pausedOpen = await call(
          'openBillOccurrence',
          {
            requestId: 'apr',
            billId: 'rent',
            month: '2027-04',
          },
          auth
        );

        assert.equal(pausedOpen.status, 400);

        // Resume rent.
        ok(await call(
          'setBillPaused',
          {
            requestId: 'resume',
            billId: 'rent',
            paused: false,
          },
          auth
        ));

        // Update future recurring rent settings.
        ok(await call(
          'updateBillRule',
          {
            requestId: 'update',
            billId: 'rent',
            name: 'New Rent',
            amountCents: 55000,
            dayOfMonth: 30,
            categoryId: 'housing',
          },
          auth
        ));

        // Historical February occurrence remains unchanged.
        assert.equal(
          (await occurrence('rent_2027-02')).amountCents,
          50000
        );

        // April uses new due day.
        const april = ok(
          await call(
            'openBillOccurrence',
            {
              requestId: 'apr2',
              billId: 'rent',
              month: '2027-04',
            },
            auth
          )
        );

        assert.equal(april.dueDate, '2027-04-30');
      });

      // ------------------------------------------------------
      // 9. User isolation
      // ------------------------------------------------------

      await t.test(
        'another user cannot alter or confirm bills',
        async () => {

          // IMPORTANT:
          // Bob must initialize his own finances first.
          // Otherwise the backend rejects him before reaching
          // the missing-bill ownership check.

          const bobOpening = await call(
            'initializeAccount',
            {
              requestId: 'bobOpening',
              amountCents: 100000,
              effectiveDate: '2027-04-30',
            },
            bob.idToken
          );

          assert.equal(
            bobOpening.status,
            200,
            JSON.stringify(bobOpening.body)
          );

          // Bob attempts to confirm Alice's April rent.
          const unauthorizedPayment = await call(
            'confirmBillPayment',
            {
              requestId: 'bobPay',
              billId: 'rent',
              occurrenceId: 'rent_2027-04',
              effectiveDate: '2027-04-30',
            },
            bob.idToken
          );

          // The bill doesn't exist under Bob's own UID.
          assert.equal(
            unauthorizedPayment.status,
            404,
            JSON.stringify(unauthorizedPayment.body)
          );

          // Verify Alice's tracked money was not changed.
          assert.equal(
            (await summary()).trackedTotalCents,
            50000
          );

          // Verify Alice's April occurrence is still unpaid.
          assert.equal(
            (await occurrence('rent_2027-04')).status,
            'unpaid'
          );

          // Verify Bob's own balance was not altered.
          const bobSummary = await getFirestore(app)
            .collection('users')
            .doc(bob.localId)
            .collection('summaries')
            .doc('current')
            .get();

          assert.equal(
            bobSummary.data().trackedTotalCents,
            100000
          );
        }
      );

    } finally {
      await deleteApp(app);
    }
  }
);
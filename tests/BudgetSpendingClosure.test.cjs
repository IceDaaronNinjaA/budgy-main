'use strict';

// Integration tests: demo-budgy Auth/Firestore/Functions emulators only.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { createRequire } = require('node:module');
const path = require('node:path');

const fromFunctions = createRequire(
  path.resolve(__dirname, '../functions/package.json')
);

const { initializeApp, deleteApp } = fromFunctions('firebase-admin/app');
const { getFirestore } = fromFunctions('firebase-admin/firestore');

process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.GCLOUD_PROJECT = 'demo-budgy';

const BASE = 'http://127.0.0.1:5001/demo-budgy/us-central1';

const date = '2026-10-15';
const periodId = 'grocery_2026-10-01';

// Create a temporary test user.
async function signUp() {
  const response = await fetch(
    'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key',
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

  assert.equal(response.status, 200, JSON.stringify(result));

  return result;
}

// Call an emulated Firebase Cloud Function.
async function call(name, data, token) {
  const response = await fetch(`${BASE}/${name}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ data }),
  });

  return {
    status: response.status,
    body: await response.json(),
  };
}

// Assert successful operation and return its result.
function ok(response) {
  assert.equal(
    response.status,
    200,
    JSON.stringify(response.body)
  );

  return response.body.result;
}

// Create a financial command.
function money(requestId, amountCents, extra = {}) {
  return {
    requestId,
    amountCents,
    effectiveDate: date,
    ...extra,
  };
}

test('budget spending and period close preserve money and history', async (t) => {
  const app = initializeApp(
    { projectId: 'demo-budgy' },
    `budget-spend-${randomUUID()}`
  );

  try {
    const alice = await signUp();
    const bob = await signUp();

    const auth = alice.idToken;

    const base = getFirestore(app)
      .collection('users')
      .doc(alice.localId);

    const summary = () =>
      base.collection('summaries')
        .doc('current')
        .get()
        .then((snapshot) => snapshot.data());

    const period = () =>
      base.collection('budgetPeriods')
        .doc(periodId)
        .get()
        .then((snapshot) => snapshot.data());

    // ---------------------------------------------------------
    // 1. Account and budget setup
    // ---------------------------------------------------------

    await t.test('setup account and budget', async () => {
      ok(await call(
        'initializeAccount',
        money('open', 100000),
        auth
      ));

      ok(await call(
        'createCategory',
        {
          requestId: 'cat',
          categoryId: 'food',
          name: 'Food',
          type: 'expense',
        },
        auth
      ));

      ok(await call(
        'createBudgetRule',
        {
          requestId: 'rule',
          budgetId: 'grocery',
          name: 'Groceries',
          categoryId: 'food',
          limitCents: 20000,
          frequency: 'monthly',
        },
        auth
      ));

      ok(await call(
        'openBudgetPeriod',
        {
          requestId: 'openperiod',
          budgetId: 'grocery',
          effectiveDate: date,
        },
        auth
      ));

      ok(await call(
        'allocateFunds',
        money('fund', 50000, {
          destinationKey: 'budget:grocery',
        }),
        auth
      ));

      const state = await summary();
      const budget = await period();

      assert.equal(state.trackedTotalCents, 100000);
      assert.equal(state.unallocatedCents, 50000);
      assert.equal(state.accounts['budget:grocery'], 50000);

      assert.equal(budget.status, 'open');
      assert.equal(budget.limitCents, 20000);
      assert.equal(budget.spentCents, 0);
      assert.equal(budget.varianceCents, 20000);
    });

    // ---------------------------------------------------------
    // 2. Reject invalid spending and overlapping periods
    // ---------------------------------------------------------

    await t.test(
      'reject unlinked spending on managed budget and future opening',
      async () => {
        const noPeriod = await call(
          'recordExpense',
          money('noPeriod', 1000, {
            sourceKey: 'budget:grocery',
          }),
          auth
        );

        assert.equal(
          noPeriod.status,
          400,
          JSON.stringify(noPeriod.body)
        );

        const opening = await call(
          'openBudgetPeriod',
          {
            requestId: 'nextperiod',
            budgetId: 'grocery',
            effectiveDate: '2026-11-03',
          },
          auth
        );

        assert.equal(
          opening.status,
          400,
          JSON.stringify(opening.body)
        );
      }
    );

    // ---------------------------------------------------------
    // 3. Record expense and update budget variance
    // ---------------------------------------------------------

    await t.test(
      'expense updates spent and variance in same transaction',
      async () => {
        const command = money('bigexpense', 22500, {
          sourceKey: 'budget:grocery',
          budgetPeriodId: periodId,
          categoryId: 'food',
          description: 'Food',
        });

        ok(await call('recordExpense', command, auth));

        const budget = await period();
        const state = await summary();

        // $225 spent against a $200 spending limit.
        assert.equal(budget.spentCents, 22500);
        assert.equal(budget.varianceCents, -2500);

        // $500 allocated, $225 spent, $275 remaining.
        assert.equal(state.accounts['budget:grocery'], 27500);

        // Total tracked money decreases by the expense.
        assert.equal(state.trackedTotalCents, 77500);

        const transaction = await base
          .collection('transactions')
          .doc('expense_bigexpense')
          .get();

        assert.equal(transaction.exists, true);
        assert.equal(transaction.data().budgetPeriodId, periodId);

        // Duplicate request must not spend money twice.
        const replay = ok(
          await call('recordExpense', command, auth)
        );

        assert.equal(replay.duplicate, true);
        assert.equal((await period()).spentCents, 22500);
        assert.equal((await summary()).trackedTotalCents, 77500);
      }
    );

    // ---------------------------------------------------------
    // 4. Reject incorrect period references and dates
    // ---------------------------------------------------------

    await t.test('wrong period and date rejected', async () => {
      const invalidCommands = [
        money('wrongperiod', 100, {
          sourceKey: 'budget:grocery',
          budgetPeriodId: 'grocery_2026-09-01',
        }),

        money('wrongdate', 100, {
          sourceKey: 'budget:grocery',
          budgetPeriodId: periodId,
          effectiveDate: '2026-11-01',
        }),
      ];

      for (const command of invalidCommands) {
        const response = await call(
          'recordExpense',
          command,
          auth
        );

        assert.notEqual(
          response.status,
          200,
          JSON.stringify(response.body)
        );
      }

      assert.equal((await period()).spentCents, 22500);
      assert.equal((await summary()).trackedTotalCents, 77500);
    });

    // ---------------------------------------------------------
    // 5. Reverse budget-linked expense
    // ---------------------------------------------------------

    await t.test(
      'linked reversals restore spending and preserve audit history',
      async () => {
        const command = {
          requestId: 'reverseBigExpense',
          transactionId: 'expense_bigexpense',
        };

        const result = ok(
          await call('reverseTransaction', command, auth)
        );

        assert.equal(
          result.reversalEventId,
          'reversal_reverseBigExpense'
        );

        const budget = await period();
        const state = await summary();

        // Reversed expense no longer counts toward spending.
        assert.equal(budget.spentCents, 0);

        // Full $200 spending allowance is restored.
        assert.equal(budget.varianceCents, 20000);

        // Original $225 expense is returned to the reserve.
        assert.equal(state.accounts['budget:grocery'], 50000);

        // Total tracked balance returns to $1,000.
        assert.equal(state.trackedTotalCents, 100000);
        assert.equal(state.unallocatedCents, 50000);

        // Original transaction must remain in history.
        const original = await base
          .collection('transactions')
          .doc('expense_bigexpense')
          .get();

        assert.equal(original.exists, true);
        assert.equal(original.data().status, 'reversed');

        // Original immutable journal entry must still exist.
        const originalJournal = await base
          .collection('journal')
          .doc('expense_bigexpense')
          .get();

        assert.equal(originalJournal.exists, true);

        // A separate reversal journal entry must exist.
        const reversalJournal = await base
          .collection('journal')
          .doc('reversal_reverseBigExpense')
          .get();

        assert.equal(reversalJournal.exists, true);

        assert.equal(
          reversalJournal.data().reversesEventId,
          'expense_bigexpense'
        );

        // Replaying the same reversal cannot restore money twice.
        const replay = ok(
          await call('reverseTransaction', command, auth)
        );

        assert.equal(replay.duplicate, true);

        assert.equal((await period()).spentCents, 0);
        assert.equal((await summary()).trackedTotalCents, 100000);

        // A second distinct reversal request must be rejected.
        const secondReversal = await call(
          'reverseTransaction',
          {
            requestId: 'reverseBigExpenseAgain',
            transactionId: 'expense_bigexpense',
          },
          auth
        );

        assert.notEqual(secondReversal.status, 200);
        assert.equal((await summary()).trackedTotalCents, 100000);
      }
    );

    // ---------------------------------------------------------
    // 6. Close budget and release remaining reserve
    // ---------------------------------------------------------

    await t.test(
      'close releases unused reserve exactly once',
      async () => {
        const command = {
          requestId: 'closebudget',
          budgetId: 'grocery',
          periodId,
        };

        const result = ok(
          await call('closeBudgetPeriod', command, auth)
        );

        // Expense was reversed, so all $500 remains allocated.
        assert.equal(result.releasedCents, 50000);

        const budget = await period();
        const state = await summary();

        assert.equal(budget.status, 'closed');

        // Historical budget spending reflects the reversal.
        assert.equal(budget.spentCents, 0);
        assert.equal(budget.varianceCents, 20000);

        // Closing releases reserved funds, not tracked money.
        assert.equal(state.trackedTotalCents, 100000);

        // All $1,000 is now unallocated.
        assert.equal(state.unallocatedCents, 100000);

        // Budget reserve is now empty.
        assert.equal(state.accounts['budget:grocery'], 0);

        // Journal records the release.
        const releaseJournal = await base
          .collection('journal')
          .doc('release_closebudget')
          .get();

        assert.equal(releaseJournal.exists, true);

        // Identical request is idempotent.
        const replay = ok(
          await call('closeBudgetPeriod', command, auth)
        );

        assert.equal(replay.duplicate, true);

        // A different request cannot close the same period twice.
        const secondClose = await call(
          'closeBudgetPeriod',
          {
            ...command,
            requestId: 'closeAgain',
          },
          auth
        );

        assert.equal(
          secondClose.status,
          400,
          JSON.stringify(secondClose.body)
        );

        assert.equal((await summary()).trackedTotalCents, 100000);
      }
    );

    // ---------------------------------------------------------
    // 7. Closed periods cannot accept additional spending
    // ---------------------------------------------------------

    await t.test(
      'cannot spend against closed period; next period can open',
      async () => {
        const lateExpense = await call(
          'recordExpense',
          money('late', 100, {
            sourceKey: 'budget:grocery',
            budgetPeriodId: periodId,
          }),
          auth
        );

        assert.equal(
          lateExpense.status,
          400,
          JSON.stringify(lateExpense.body)
        );

        const next = ok(
          await call(
            'openBudgetPeriod',
            {
              requestId: 'nextPeriodValid',
              budgetId: 'grocery',
              effectiveDate: '2026-11-03',
            },
            auth
          )
        );

        assert.equal(next.startDate, '2026-11-01');
        assert.equal(next.spentCents, 0);
      }
    );

    // ---------------------------------------------------------
    // 8. User isolation
    // ---------------------------------------------------------

    await t.test(
      'cannot close another users period',
      async () => {
        const response = await call(
          'closeBudgetPeriod',
          {
            requestId: 'bobClose',
            budgetId: 'grocery',
            periodId,
          },
          bob.idToken
        );

        assert.equal(
          response.status,
          404,
          JSON.stringify(response.body)
        );
      }
    );

  } finally {
    await deleteApp(app);
  }
});
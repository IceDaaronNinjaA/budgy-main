import test from 'node:test';
import assert from 'node:assert/strict';
import { assertCents, parseUsdToCents, formatUsdFromCents } from '../src/domain/MoneyCalculations.js';
import {
  emptyLedger, applyEvent, openingBalance, recordIncome, allocate, release,
  transfer, expenseFromState, reserveAccount, ledgerSummary, accountBalance,
} from '../src/domain/LedgerCalculations.js';

let n = 0;
function meta() {
  n += 1;
  return { eventId: `event_${n}`, requestId: `request_${n}`, effectiveDate: '2026-11-06' };
}
function apply(state, evt) { return applyEvent(state, evt); }
function summary(state) { return ledgerSummary(state); }
const budget = reserveAccount('budget', 'fun');
const goal = reserveAccount('goal', 'tv');
const bill = reserveAccount('bill', 'rent');

test('money parsing rejects floats, exponent notation, negative, unsafe, and malformed values', () => {
  assert.equal(parseUsdToCents('12.34'), 1234);
  assert.equal(parseUsdToCents('0'), 0);
  assert.equal(parseUsdToCents('0.5'), 50);
  assert.equal(formatUsdFromCents(-125), '-$1.25');
  for (const bad of ['1.999', '-1', '1e3', '$10', '', '01.0', '900719925474099.12']) {
    assert.throws(() => parseUsdToCents(bad));
  }
  assert.throws(() => assertCents(0.1));
  assert.throws(() => assertCents(Infinity));
});

test('TEST-001: opening balance including $0 is permitted, not classified as income', () => {
  const zero = apply(emptyLedger(), openingBalance(meta(), 0));
  assert.deepEqual(summary(zero), { trackedTotalCents: 0, unallocatedCents: 0,
    budgetReserveCents: 0, billReserveCents: 0, savingsReserveCents: 0 });
  let state = apply(emptyLedger(), openingBalance(meta(), 20000));
  assert.equal(summary(state).trackedTotalCents, 20000);
  assert.equal(summary(state).unallocatedCents, 20000);
});

test('TEST-002–007: income, allocate, overspend, save, withdraw, goal-funded purchase', () => {
  let state = apply(emptyLedger(), openingBalance(meta(), 20000));
  state = apply(state, recordIncome(meta(), 150000));
  assert.equal(summary(state).trackedTotalCents, 170000);
  state = apply(state, allocate(meta(), 7500, budget));
  assert.equal(summary(state).unallocatedCents, 162500);
  state = apply(state, expenseFromState(state, meta(), 10000, budget));
  assert.equal(summary(state).trackedTotalCents, 160000);
  assert.equal(summary(state).unallocatedCents, 160000);
  assert.equal(accountBalance(state, budget), 0);
  state = apply(state, allocate(meta(), 10000, goal));
  assert.equal(summary(state).savingsReserveCents, 10000);
  state = apply(state, release(meta(), 2000, goal));
  assert.equal(summary(state).savingsReserveCents, 8000);
  state = apply(state, expenseFromState(state, meta(), 8000, goal));
  assert.equal(summary(state).trackedTotalCents, 152000);
  assert.equal(summary(state).savingsReserveCents, 0);
});

test('TEST-003/004 exact worked example: 1700, four allocations, 100 fun spend', () => {
  let state = apply(emptyLedger(), openingBalance(meta(), 170000));
  for (const [id, cents] of [['rent', 40000], ['utilities', 5000], ['fun', 7500], ['groceries', 30000]]) {
    state = apply(state, allocate(meta(), cents, reserveAccount('budget', id)));
  }
  assert.equal(summary(state).unallocatedCents, 87500);
  assert.equal(summary(state).budgetReserveCents, 82500);
  state = apply(state, expenseFromState(state, meta(), 10000, budget));
  assert.equal(summary(state).trackedTotalCents, 160000);
  assert.equal(summary(state).unallocatedCents, 85000);
  assert.equal(summary(state).budgetReserveCents, 75000);
});

test('TEST-011: overspend creates explicitly negative unallocated, no invented money', () => {
  let state = apply(emptyLedger(), openingBalance(meta(), 4000));
  state = apply(state, allocate(meta(), 3000, budget));
  state = apply(state, expenseFromState(state, meta(), 6000, budget));
  assert.equal(summary(state).trackedTotalCents, -2000);
  assert.equal(summary(state).unallocatedCents, -2000);
  assert.equal(accountBalance(state, budget), 0);
});

test('transfers cannot overdraw internal reserves or unallocated', () => {
  let state = apply(emptyLedger(), openingBalance(meta(), 5000));
  state = apply(state, allocate(meta(), 3000, budget));
  state = apply(state, transfer(meta(), 1000, budget, bill));
  assert.equal(summary(state).billReserveCents, 1000);
  assert.throws(() => apply(state, allocate(meta(), 3000, goal)), /Insufficient unallocated/);
  assert.throws(() => apply(state, release(meta(), 4000, budget)), /Insufficient reserve/);
  assert.throws(() => expenseFromState(state, meta(), 1500, bill), /Insufficient goal or bill reserve/);
});

test('repeating identical request is a no-op; conflicting reuse is rejected', () => {
  const first = openingBalance(meta(), 20000);
  const state = apply(emptyLedger(), first);
  assert.equal(apply(state, first), state);
  assert.throws(() => apply(state, { ...first, amountCents: 10000 }), /collision|sum to zero/);
});

test('invalid posting balance and calendar date are rejected', () => {
  assert.throws(() => openingBalance({ ...meta(), effectiveDate: '2026-02-30' }, 100));
  const evt = recordIncome(meta(), 123);
  assert.throws(() => applyEvent(emptyLedger(), {
    ...evt, postings: [{ accountKey: 'external', deltaCents: -122 }, { accountKey: 'unallocated', deltaCents: 123 }],
  }), /sum to zero/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateBalanceSummary, calculateDashboardMetrics } from '../src/domain/DashboardCalculations.js';

const summary = {
  trackedTotalCents: 359720,
  unallocatedCents: 298575,
  budgetReserveCents: 36145,
  billReserveCents: 0,
  savingsReserveCents: 25000,
};

test('balance summary keeps total = unallocated + reserves', () => {
  const balance = calculateBalanceSummary(summary);
  assert.equal(balance.trackedTotalCents, 359720);
  assert.equal(balance.reservedCents, 61145);
  assert.equal(balance.unallocatedCents + balance.reservedCents, balance.trackedTotalCents);
});

test('empty account shows zeros, not sample money (FR-DASH-006)', () => {
  assert.deepEqual(calculateBalanceSummary(), {
    trackedTotalCents: 0, unallocatedCents: 0, budgetReserveCents: 0,
    billReserveCents: 0, savingsReserveCents: 0, reservedCents: 0,
  });
});

test('negative unallocated funds are preserved, not hidden', () => {
  assert.equal(calculateBalanceSummary({ unallocatedCents: -1500 }).unallocatedCents, -1500);
});

test('non-integer stored amounts are ignored rather than miscounted', () => {
  assert.equal(calculateBalanceSummary({ trackedTotalCents: 12.5 }).trackedTotalCents, 0);
});

test('dashboard sums current-month income and expenses', () => {
  const metrics = calculateDashboardMetrics({
    summary,
    transactions: [
      { eventType: 'income', amountCents: 250000, effectiveDate: '2026-11-01' },
      { eventType: 'expense', amountCents: 8640, effectiveDate: '2026-11-03' },
      { eventType: 'expense', amountCents: 999, effectiveDate: '2026-10-31' },
    ],
  }, new Date(2026, 10, 10));
  assert.equal(metrics.availableBalanceCents, 298575);
  assert.equal(metrics.incomeCents, 250000);
  assert.equal(metrics.expensesCents, 8640);
});

test('corrected $100 expense counts as $10, not $110 (TEST-017)', () => {
  const metrics = calculateDashboardMetrics({
    transactions: [
      { eventType: 'expense', amountCents: 10000, effectiveDate: '2026-11-05', status: 'reversed' },
      { eventType: 'expense', amountCents: 1000, effectiveDate: '2026-11-05' },
    ],
  }, new Date(2026, 10, 10));
  assert.equal(metrics.expensesCents, 1000);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { aggregateIncomeByMonth, aggregateSpendingByMonth, incomeSummary, spendingSummary } from '../src/domain/SpendingCalculations.js';

const expense = (amountCents, effectiveDate, categoryId = 'food') => ({
  eventType: 'expense', amountCents, effectiveDate, categoryId,
});

test('spending aggregation groups actual expenses by effective month', () => {
  const result = aggregateSpendingByMonth([
    expense(1200, '2026-10-31'),
    expense(800, '2026-11-02'),
    expense(500, '2026-11-18'),
  ], { months: 2, endDate: '2026-11-18' });
  assert.deepEqual(result.buckets.map(({ key, amountCents }) => ({ key, amountCents })), [
    { key: '2026-10', amountCents: 1200 },
    { key: '2026-11', amountCents: 1300 },
  ]);
});

test('income and transfers are excluded from spending', () => {
  const result = spendingSummary([
    expense(2500, '2026-11-01'),
    { eventType: 'income', amountCents: 100000, effectiveDate: '2026-11-02' },
    { eventType: 'transfer', amountCents: 5000, effectiveDate: '2026-11-03' },
  ], { startDate: '2026-11-01', endDate: '2026-11-30' });
  assert.equal(result.totalCents, 2500);
  assert.equal(result.transactionCount, 1);
  assert.deepEqual(incomeSummary([
    { eventType: 'income', amountCents: 100000, effectiveDate: '2026-11-02' },
    { eventType: 'transfer', amountCents: 5000, effectiveDate: '2026-11-03' },
  ]), { totalCents: 100000, transactionCount: 1 });
  assert.equal(aggregateIncomeByMonth([{ eventType: 'income', amountCents: 100000, effectiveDate: '2026-11-02' }], { months: 1, endDate: '2026-11-02' }).buckets[0].amountCents, 100000);
});

test('empty and invalid spending input produces a truthful zero summary', () => {
  assert.deepEqual(spendingSummary([]), { totalCents: 0, transactionCount: 0, categoryTotals: {} });
  assert.equal(aggregateSpendingByMonth([{ eventType: 'expense', amountCents: -1, effectiveDate: 'bad' }]).expenses.length, 0);
});


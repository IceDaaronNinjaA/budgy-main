import { test } from 'node:test';
import assert from 'node:assert/strict';
import { periodForDate, budgetVariance, calendarDay } from '../src/domain/BudgetCalculations.js';
test('weekly periods begin Monday even at year boundary', () => {
  assert.deepEqual(periodForDate('weekly','2026-11-06'), { frequency: 'weekly', startDate:'2026-11-02',endExclusiveDate:'2026-11-09'});
  assert.equal(periodForDate('weekly','2027-01-01').startDate,'2026-12-28');
});
test('monthly periods handle leap year', () => {
  assert.deepEqual(periodForDate('monthly','2028-02-29'), { frequency:'monthly',startDate:'2028-02-01',endExclusiveDate:'2028-03-01'});
});
test('reject invalid calendar dates and frequency', () => {
  for(const d of ['2026-02-29','2026-13-01','abc']) assert.throws(()=>calendarDay(d));
  assert.throws(()=>periodForDate('daily','2026-11-06'));
});
test('variance differs from allocated reserve and may be negative',()=>{
  assert.equal(budgetVariance(50000,35000),15000);
  assert.equal(budgetVariance(7500,10000),-2500);
  assert.throws(()=>budgetVariance(0,50));
});

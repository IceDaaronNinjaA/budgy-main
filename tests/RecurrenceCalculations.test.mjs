import { test } from 'node:test';
import assert from 'node:assert/strict';
import { billDueDate, billStatus, calendarDate } from '../src/domain/RecurrenceCalculations.js';
test('monthly recurrence clamps short months, including leap years', () => {
  assert.equal(billDueDate('2026-02', 31), '2026-02-28');
  assert.equal(billDueDate('2028-02', 31), '2028-02-29');
  assert.equal(billDueDate('2026-04', 31), '2026-04-30');
  assert.equal(billDueDate('2026-11', 6), '2026-11-06');
});
test('invalid recurrence and calendar dates reject', () => {
  for (const month of ['2026-00','2026-13','2026-1']) assert.throws(() => billDueDate(month,12));
  for (const day of [0,32,3.3,'15']) assert.throws(() => billDueDate('2026-02',day));
  assert.throws(() => calendarDate('2026-02-29'));
});
test('bill status only reports actual paid status after confirmation', () => {
  const bill = {dueDate:'2026-10-31', amountCents:10000, status:'unpaid'};
  assert.deepEqual(billStatus(bill,'2026-11-01',2500),{
    status:'overdue',dueDate:'2026-10-31',reservedCents:2500,fundingShortfallCents:7500,
  });
  assert.equal(billStatus({...bill,status:'paid'},'2026-11-01',0).status,'paid');
});

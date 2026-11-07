// Calendar-only recurrence helpers; no Firebase or UI dependencies.
export function calendarDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new TypeError('Expected YYYY-MM-DD');
  const date = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new RangeError('Invalid calendar date');
  return value;
}
export function billDueDate(month, dayOfMonth) {
  if (typeof month !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new TypeError('Expected YYYY-MM');
  if (!Number.isInteger(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 31) throw new RangeError('dayOfMonth must be 1–31');
  const [year, m] = month.split('-').map(Number);
  const lastDay = new Date(Date.UTC(year, m, 0)).getUTCDate();
  return `${month}-${String(Math.min(dayOfMonth, lastDay)).padStart(2, '0')}`;
}
export function billStatus(occurrence, asOfDate, reservedCents) {
  calendarDate(asOfDate);
  if (!occurrence || !['unpaid', 'paid', 'skipped'].includes(occurrence.status)) throw new TypeError('Invalid bill occurrence');
  calendarDate(occurrence.dueDate);
  if (!Number.isSafeInteger(occurrence.amountCents) || occurrence.amountCents <= 0 ||
      !Number.isSafeInteger(reservedCents) || reservedCents < 0) throw new RangeError('Invalid amount');
  return {
    status: occurrence.status === 'unpaid' && occurrence.dueDate < asOfDate ? 'overdue' : occurrence.status,
    dueDate: occurrence.dueDate,
    reservedCents,
    fundingShortfallCents: Math.max(0, occurrence.amountCents - reservedCents),
  };
}

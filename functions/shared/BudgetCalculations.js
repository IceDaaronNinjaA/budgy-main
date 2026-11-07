// Pure local-calendar budget period and variance calculations.
const DATE = /^\d{4}-\d{2}-\d{2}$/;
export function calendarDay(date) {
  if (typeof date !== 'string' || !DATE.test(date)) throw new TypeError('Date must be YYYY-MM-DD');
  const d = new Date(`${date}T00:00:00.000Z`);
  if (!Number.isFinite(d.getTime()) || d.toISOString().slice(0, 10) !== date) throw new RangeError('Invalid calendar date');
  return d;
}
function iso(d) { return d.toISOString().slice(0, 10); }
export function periodForDate(frequency, effectiveDate) {
  const d = calendarDay(effectiveDate);
  if (!['weekly','monthly'].includes(frequency)) throw new RangeError('frequency must be weekly or monthly');
  let start, end;
  if (frequency === 'weekly') {
    start = new Date(d.getTime());
    start.setUTCDate(start.getUTCDate() - (start.getUTCDay() + 6) % 7);
    end = new Date(start.getTime());
    end.setUTCDate(end.getUTCDate() + 7);
  } else {
    start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
    end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
  }
  return { startDate: iso(start), endExclusiveDate: iso(end), frequency };
}
export function budgetVariance(limitCents, spentCents) {
  if (!Number.isSafeInteger(limitCents) || limitCents <= 0 || !Number.isSafeInteger(spentCents) || spentCents < 0) {
    throw new RangeError('Budget limit must be positive and spending must be nonnegative safe-integer cents');
  }
  const value = limitCents - spentCents;
  if (!Number.isSafeInteger(value)) throw new RangeError('Budget variance out of range');
  return value;
}

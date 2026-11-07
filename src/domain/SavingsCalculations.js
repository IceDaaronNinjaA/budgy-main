// Pure calendar-day calculations; start and deadline are inclusive.
import { assertCents } from './MoneyCalculations.js';
const DAY = 86400000;
export function dayNumber(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new TypeError('Date must be YYYY-MM-DD');
  const ms = Date.parse(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(ms) || new Date(ms).toISOString().slice(0,10) !== value) throw new RangeError('Invalid calendar date');
  return ms / DAY;
}
export function savingsProgress({targetCents, savedCents, startDate, deadlineDate, asOfDate}) {
  assertCents(targetCents, 'targetCents', {allowZero:false});
  assertCents(savedCents, 'savedCents');
  const start=dayNumber(startDate), deadline=dayNumber(deadlineDate), today=dayNumber(asOfDate);
  if (deadline < start) throw new RangeError('Deadline cannot precede start date');
  const remainingCents=Math.max(0,targetCents-savedCents);
  const daysRemaining=Math.max(0,deadline-Math.max(today,start)+1);
  const dailyRequiredCents=remainingCents===0 ? 0 : daysRemaining===0 ? null : Math.ceil(remainingCents/daysRemaining);
  const elapsedDays=Math.min(deadline-start+1,Math.max(0,today-start+1));
  const totalDays=deadline-start+1;
  const scheduledCents=Math.ceil(targetCents*elapsedDays/totalDays);
  const progressPercent=Math.round((savedCents/targetCents)*10000)/100;
  return {targetCents,savedCents,remainingCents,daysRemaining,dailyRequiredCents,
    progressPercent, scheduledCents, onTrack:savedCents>=scheduledCents,
    completed:savedCents>=targetCents,overdue:today>deadline && remainingCents>0};
}

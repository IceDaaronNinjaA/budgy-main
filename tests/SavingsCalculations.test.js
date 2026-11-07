import {test} from 'node:test';
import assert from 'node:assert/strict';
import {savingsProgress,dayNumber} from '../src/domain/SavingsCalculations.js';
test('calendar dates valid, leap days and inclusive deadline',()=>{
 assert.equal(dayNumber('2028-03-01')-dayNumber('2028-02-28'),2);
 assert.throws(()=>dayNumber('2027-02-29'));
 const p=savingsProgress({targetCents:30000,savedCents:0,startDate:'2026-11-01',deadlineDate:'2026-11-10',asOfDate:'2026-11-01'});
 assert.equal(p.daysRemaining,10);assert.equal(p.dailyRequiredCents,3000);assert.equal(p.onTrack,false);
});
test('progress, completed, overdue, and zero remaining days',()=>{
 const base={targetCents:10000,startDate:'2026-11-01',deadlineDate:'2026-11-10'};
 let p=savingsProgress({...base,savedCents:10000,asOfDate:'2026-11-08'});
 assert.equal(p.completed,true);assert.equal(p.dailyRequiredCents,0);
 p=savingsProgress({...base,savedCents:100,asOfDate:'2026-11-11'});
 assert.equal(p.overdue,true);assert.equal(p.dailyRequiredCents,null);
 assert.throws(()=>savingsProgress({...base,savedCents:0,deadlineDate:'2026-10-31',asOfDate:'2026-11-11'}));
});

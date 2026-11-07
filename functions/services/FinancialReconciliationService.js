'use strict';
// Authenticated, on-demand reconciliation after an app resumes from offline.
// This is NOT a scheduled job. Each lifecycle step is a separately idempotent
// Firestore transaction implemented by the existing domain services.
const { HttpsError } = require('firebase-functions/v2/https');
const { getFirestore } = require('firebase-admin/firestore');
const { createHash, randomUUID } = require('node:crypto');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const budgets = require('./BudgetManagementService');
const periods = require('./BudgetPeriodClosureService');
const bills = require('./RecurringBillService');
const funding = require('./AutomaticFundingService');
const datesPromise = import(pathToFileURL(path.join(__dirname, '../shared/BudgetCalculations.js')).href);
const { dateInZone } = require('./FinancialAutomationSettingsService');
// PHASE16_LOCAL_DATE

function stableId(action, kind, id, period) {
  const digest = createHash('sha256').update(JSON.stringify([action, kind, id, period])).digest('hex').slice(0, 36);
  return `reconcile_${digest}`;
}
function checkInput(request) {
  const uid = request.auth?.uid;
  if (typeof uid !== 'string' || !uid) throw new HttpsError('unauthenticated', 'Sign in first.');
  if (!request.data || typeof request.data !== 'object' || Array.isArray(request.data) ||
      Object.keys(request.data).length !== 0) {
    throw new HttpsError('invalid-argument', 'reconcileFinancialSchedule takes an empty object.');
  }
  return uid;
}
function statusFromError(e) {
  // An existing occurrence can have been opened by another request in parallel.
  // Recheck on retry rather than declaring success on a conflict.
  return {code:e.code || 'internal', message:e.message || 'Unknown error'};
}
async function reconcileFinancialSchedule(request) {
  const uid = checkInput(request);
  const db = getFirestore();
  const base = db.collection('users').doc(uid);
  const settingsSnap = await base.collection('settings').doc('financialAutomation').get();
  const timeZone = settingsSnap.exists ? settingsSnap.data().timeZone : 'UTC';
  const asOfDate = dateInZone(new Date(), timeZone);
  const calculations = await datesPromise;
  const [summarySnap, budgetSnap, billSnap] = await Promise.all([
    base.collection('summaries').doc('current').get(),
    base.collection('budgetRules').get(),
    base.collection('billRules').get(),
  ]);
  if (!summarySnap.exists) throw new HttpsError('failed-precondition', 'Initialize your financial account first.');
  if (budgetSnap.size + billSnap.size > 40) throw new HttpsError('resource-exhausted', 'Reconciliation supports at most 40 rules.');
  const results = [];
  const auth = { uid };
  const invoke = (handler, data) => handler({auth, data});

  // Finish expired budgets before opening a new period. No retroactive empty
  // periods are fabricated. Existing spent/limit snapshots remain untouched.
  for (const snap of budgetSnap.docs) {
    const rule = snap.data(), budgetId = snap.id;
    try {
      if (rule.openPeriodId) {
        const active = await base.collection('budgetPeriods').doc(rule.openPeriodId).get();
        if (!active.exists) throw new HttpsError('failed-precondition', 'Budget references a missing open period.');
        const p = active.data();
        if (p.budgetId !== budgetId || p.status !== 'open') throw new HttpsError('failed-precondition', 'Budget open period is inconsistent.');
        if (p.endExclusiveDate <= asOfDate) {
          await invoke(periods.closeBudgetPeriod, {
            requestId: stableId('close', 'budget', budgetId, rule.openPeriodId),
            budgetId, periodId: rule.openPeriodId,
          });
          results.push({kind:'budget', ruleId:budgetId, action:'closed', occurrenceId:rule.openPeriodId});
        } else {
          results.push({kind:'budget', ruleId:budgetId, action:'already_open', occurrenceId:rule.openPeriodId});
          continue;
        }
      }
      if (rule.paused) { results.push({kind:'budget',ruleId:budgetId,action:'paused'}); continue; }
      const p = calculations.periodForDate(rule.frequency, asOfDate);
      const periodId = `${budgetId}_${p.startDate}`;
      const existing = await base.collection('budgetPeriods').doc(periodId).get();
      if (existing.exists) {
        results.push({kind:'budget',ruleId:budgetId,action:existing.data().status === 'open' ? 'already_open' : 'already_closed',occurrenceId:periodId});
        continue;
      }
      await invoke(budgets.openBudgetPeriod, {
        requestId: stableId('open', 'budget', budgetId, p.startDate),
        budgetId, effectiveDate: asOfDate,
      });
      results.push({kind:'budget',ruleId:budgetId,action:'opened',occurrenceId:periodId});
    } catch (e) {
      results.push({kind:'budget',ruleId:budgetId,action:'error',error:statusFromError(e)});
    }
  }

  // An unpaid bill must remain pending: a due date never proves actual payment.
  // Only create this month's occurrence if the bill has no active occurrence.
  for (const snap of billSnap.docs) {
    const rule = snap.data(), billId = snap.id;
    try {
      if (rule.openOccurrenceId) {
        results.push({kind:'bill',ruleId:billId,action:'awaiting_confirmation',occurrenceId:rule.openOccurrenceId});
        continue;
      }
      if (rule.paused) { results.push({kind:'bill',ruleId:billId,action:'paused'}); continue; }
      const month = asOfDate.slice(0, 7), occurrenceId = `${billId}_${month}`;
      const existing = await base.collection('billOccurrences').doc(occurrenceId).get();
      if (existing.exists) {
        results.push({kind:'bill',ruleId:billId,action:existing.data().status === 'unpaid' ? 'already_open':'already_finished',occurrenceId});
        continue;
      }
      await invoke(bills.openBillOccurrence, {
        requestId:stableId('open','bill',billId,month),billId,month,
      });
      results.push({kind:'bill',ruleId:billId,action:'opened',occurrenceId});
    } catch (e) {
      results.push({kind:'bill',ruleId:billId,action:'error',error:statusFromError(e)});
    }
  }

  // Funding engine enforces priority and available-cash limits transactionally.
  // Each invocation uses a fresh request ID; available reserve balances prevent
  // duplicate allocations. This also permits funding after new income arrives.
  let fundingResult = null;
  try {
    fundingResult = await invoke(funding.runFundingCycle, {
      requestId: `reconcile_fund_${randomUUID().replace(/-/g,'')}`,
      effectiveDate: asOfDate,
    });
  } catch(e) {
    results.push({kind:'funding',action:'error',error:statusFromError(e)});
  }
  return {asOfDate, dateBasis:timeZone, lifecycle:results, funding:fundingResult,
    partial:results.some(r=>r.action==='error')};
}
module.exports = {reconcileFinancialSchedule};

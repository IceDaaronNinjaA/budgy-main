'use strict';
const { HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const ledgerPromise = import(pathToFileURL(path.join(__dirname, '../shared/LedgerCalculations.js')).href);
const ID = /^[A-Za-z0-9_-]{1,100}$/;
function dateIsValid(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === value;
}
function input(request) {
  const uid = request.auth?.uid;
  if (typeof uid !== 'string' || !uid) throw new HttpsError('unauthenticated', 'Sign in first.');
  const data = request.data;
  if (!data || typeof data !== 'object' || Array.isArray(data) ||
      Object.keys(data).some(k => !['requestId','budgetId','periodId'].includes(k))) {
    throw new HttpsError('invalid-argument', 'Invalid period closure payload.');
  }
  if (typeof data.requestId !== 'string' || !ID.test(data.requestId) ||
      typeof data.budgetId !== 'string' || !ID.test(data.budgetId) ||
      typeof data.periodId !== 'string' ||
      !/^[A-Za-z0-9_-]{1,100}_\d{4}-\d{2}-\d{2}$/.test(data.periodId)) {
    throw new HttpsError('invalid-argument', 'Invalid requestId, budgetId or periodId.');
  }
  return { uid, ...data };
}
async function closeBudgetPeriod(request) {
  const cmd = input(request);
  const ledger = await ledgerPromise;
  const base = getFirestore().collection('users').doc(cmd.uid);
  const receiptRef = base.collection('operations').doc(cmd.requestId);
  const periodRef = base.collection('budgetPeriods').doc(cmd.periodId);
  const summaryRef = base.collection('summaries').doc('current');
  const ruleRef = base.collection('budgetRules').doc(cmd.budgetId);
  const eventId = `release_${cmd.requestId}`;
  const journalRef = base.collection('journal').doc(eventId);
  const fingerprint = JSON.stringify({ action: 'closeBudgetPeriod', budgetId: cmd.budgetId, periodId: cmd.periodId });
  return getFirestore().runTransaction(async tx => {
    const [receiptSnap, periodSnap, summarySnap, ruleSnap] = await Promise.all([
      tx.get(receiptRef), tx.get(periodRef), tx.get(summaryRef), tx.get(ruleRef),
    ]);
    if (receiptSnap.exists) {
      const prior = receiptSnap.data();
      if (prior.fingerprint !== fingerprint) throw new HttpsError('already-exists', 'Conflicting requestId.');
      return { ...prior.result, duplicate: true };
    }
    if (!periodSnap.exists) throw new HttpsError('not-found', 'Budget period not found.');
    if (!summarySnap.exists) throw new HttpsError('failed-precondition', 'Account not initialized.');
    if (!ruleSnap.exists) throw new HttpsError('failed-precondition', 'Budget rule not found.');
    if (ruleSnap.data().openPeriodId && ruleSnap.data().openPeriodId !== cmd.periodId) {
      throw new HttpsError('failed-precondition', 'Budget rule references a different open period.');
    }
    const period = periodSnap.data();
    if (period.budgetId !== cmd.budgetId || cmd.periodId !== `${cmd.budgetId}_${period.startDate}` ||
        !dateIsValid(period.startDate) || !dateIsValid(period.endExclusiveDate)) {
      throw new HttpsError('failed-precondition', 'Budget period is inconsistent.');
    }
    if (period.status !== 'open') throw new HttpsError('failed-precondition', 'Period already closed.');
    // Server UTC date is a conservative guard against client-supplied future dates.
    // A proper time-zone setting and scheduled catch-up remain future work.
    const todayUtc = new Date().toISOString().slice(0, 10);
    if (todayUtc < period.endExclusiveDate) {
      throw new HttpsError('failed-precondition', 'Cannot close a period before its end date.');
    }
    const previous = summarySnap.data();
    const accounts = previous.accounts;
    if (!accounts || typeof accounts !== 'object' || Array.isArray(accounts) ||
        Object.values(accounts).some(x => !Number.isSafeInteger(x))) {
      throw new HttpsError('failed-precondition', 'Stored balances are invalid.');
    }
    const computed = ledger.ledgerSummary({ accounts, receipts: {} });
    if (Object.keys(computed).some(k => previous[k] !== computed[k])) {
      throw new HttpsError('failed-precondition', 'Stored balances are inconsistent.');
    }
    const sourceKey = `budget:${cmd.budgetId}`;
    const amountCents = accounts[sourceKey] ?? 0;
    if (!Number.isSafeInteger(amountCents) || amountCents < 0) {
      throw new HttpsError('failed-precondition', 'Invalid budget reserve.');
    }
    // If a budget can have two concurrent open periods, its single reserve cannot
    // be attributed to just one period. Refuse automatic release unless this is
    // the sole open period; concurrent openings are prevented by the rule service
    // in the companion patch below.
    const result = { periodId: cmd.periodId, budgetId: cmd.budgetId,
      releasedCents: amountCents, spentCents: period.spentCents, varianceCents: period.varianceCents };
    if (amountCents > 0) {
      const event = ledger.release({ eventId, requestId: cmd.requestId,
        effectiveDate: period.endExclusiveDate }, amountCents, sourceKey);
      const state = ledger.applyEvent({ accounts, receipts: {} }, event);
      const updated = ledger.ledgerSummary(state);
      tx.create(journalRef, { ...event, schemaVersion: 1, budgetPeriodId: cmd.periodId,
        createdAt: FieldValue.serverTimestamp() });
      tx.update(summaryRef, { ...updated, accounts: state.accounts,
        lastEventId: eventId, updatedAt: FieldValue.serverTimestamp() });
    }
    tx.update(ruleRef, { openPeriodId: FieldValue.delete(), updatedAt: FieldValue.serverTimestamp() });
    tx.update(periodRef, { status: 'closed', releasedCents: amountCents,
      closedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
    tx.create(receiptRef, { requestId: cmd.requestId, fingerprint, kind: 'budget_close',
      eventId: amountCents ? eventId : null, status: 'committed', result,
      createdAt: FieldValue.serverTimestamp() });
    return { ...result, duplicate: false };
  });
}
module.exports = { closeBudgetPeriod };

'use strict';

const { HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { pathToFileURL } = require('node:url');
const path = require('node:path');

const ledgerPromise = import(pathToFileURL(path.join(__dirname, '../shared/LedgerCalculations.js')).href);
const ID = /^[A-Za-z0-9_-]{1,90}$/;
const CATEGORY_ID = /^[A-Za-z0-9_-]{1,128}$/;

function badInput(error) {
  if (error instanceof HttpsError) throw error;
  if (error instanceof TypeError || error instanceof RangeError) {
    throw new HttpsError('invalid-argument', error.message);
  }
  throw error;
}

function parseRequest(request, kind) {
  const uid = request.auth?.uid;
  if (typeof uid !== 'string' || !uid) throw new HttpsError('unauthenticated', 'Sign in first.');
  const data = request.data;
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new HttpsError('invalid-argument', 'Command data must be an object.');
  }
  const allowed = kind === 'correct'
    ? ['requestId', 'transactionId', 'amountCents', 'effectiveDate', 'sourceKey', 'description', 'categoryId']
    : ['requestId', 'transactionId'];
  if (Object.keys(data).some((key) => !allowed.includes(key))) {
    throw new HttpsError('invalid-argument', 'Unrecognized command fields.');
  }
  if (typeof data.requestId !== 'string' || !ID.test(data.requestId)) {
    throw new HttpsError('invalid-argument', 'requestId must be 1–90 letters, digits, _ or -.');
  }
  // PHASE16_BILL_PAYMENT_CORRECTION_GUARD: bill payments are confirmed
  // occurrences, not independent expenses. They must not be corrected through
  // generic transaction APIs (which cannot update the occurrence state).
  if (typeof data.transactionId === 'string' && data.transactionId.startsWith('bill_pay_')) {
    throw new HttpsError('failed-precondition', 'Confirmed bill payments cannot be changed using generic transaction correction.');
  }
  if (typeof data.transactionId !== 'string' || !/^(income|expense|corrected)_[A-Za-z0-9_-]{1,110}$/.test(data.transactionId)) {
    throw new HttpsError('invalid-argument', 'transactionId must be an existing income or expense event ID.');
  }
  if (kind === 'correct') {
    if (!Number.isSafeInteger(data.amountCents) || data.amountCents <= 0) {
      throw new HttpsError('invalid-argument', 'amountCents must be positive safe-integer cents.');
    }
    // The ledger verifies calendar dates and account keys when constructing the replacement.
    if (typeof data.effectiveDate !== 'string') {
      throw new HttpsError('invalid-argument', 'effectiveDate is required.');
    }
    if (Object.hasOwn(data, 'description') && (typeof data.description !== 'string' ||
        data.description.trim().length < 1 || data.description.trim().length > 200)) {
      throw new HttpsError('invalid-argument', 'description must be 1–200 nonblank characters.');
    }
    if (Object.hasOwn(data, 'categoryId') && data.categoryId !== null &&
        (typeof data.categoryId !== 'string' || !CATEGORY_ID.test(data.categoryId))) {
      throw new HttpsError('invalid-argument', 'Invalid categoryId.');
    }
    if (Object.hasOwn(data, 'sourceKey') && typeof data.sourceKey !== 'string') {
      throw new HttpsError('invalid-argument', 'sourceKey must be a string.');
    }
  }
  return { uid, kind, requestId: data.requestId, transactionId: data.transactionId,
    ...(kind === 'correct' ? {
      amountCents: data.amountCents, effectiveDate: data.effectiveDate,
      ...(Object.hasOwn(data, 'sourceKey') ? { sourceKey: data.sourceKey } : {}),
      ...(Object.hasOwn(data, 'description') ? { description: data.description.trim() } : {}),
      ...(Object.hasOwn(data, 'categoryId') ? { categoryId: data.categoryId } : {}),
    } : {}) };
}

function readAccounts(summary, ledger) {
  if (!summary) throw new HttpsError('failed-precondition', 'Account not initialized.');
  const accounts = summary.accounts ?? { unallocated: summary.unallocatedCents };
  if (!accounts || typeof accounts !== 'object' || Array.isArray(accounts) ||
      Object.values(accounts).some((v) => !Number.isSafeInteger(v))) {
    throw new HttpsError('failed-precondition', 'Stored accounts are invalid.');
  }
  let computed;
  try { computed = ledger.ledgerSummary({ accounts, receipts: {} }); }
  catch { throw new HttpsError('failed-precondition', 'Stored accounts are inconsistent.'); }
  for (const [key, value] of Object.entries(computed)) {
    if (summary[key] !== value) throw new HttpsError('failed-precondition', 'Stored accounts are inconsistent.');
  }
  return accounts;
}

function replacementEvent(ledger, cmd, original, state, eventId) {
  const meta = { eventId, requestId: cmd.requestId, effectiveDate: cmd.effectiveDate };
  if (original.eventType === 'income') {
    if (Object.hasOwn(cmd, 'sourceKey')) {
      throw new HttpsError('invalid-argument', 'Income corrections cannot have a sourceKey.');
    }
    return ledger.recordIncome(meta, cmd.amountCents);
  }
  const sourceKey = cmd.sourceKey ?? original.sourceKey;
  return ledger.recordExpense(meta, cmd.amountCents, sourceKey, state.accounts[sourceKey] ?? 0);
}

async function perform(request, kind) {
  const cmd = parseRequest(request, kind);
  const ledger = await ledgerPromise;
  const fingerprint = JSON.stringify({ kind, transactionId: cmd.transactionId,
    ...(kind === 'correct' ? { amountCents: cmd.amountCents, effectiveDate: cmd.effectiveDate,
      ...(Object.hasOwn(cmd, 'sourceKey') ? { sourceKey: cmd.sourceKey } : {}),
      ...(Object.hasOwn(cmd, 'description') ? { description: cmd.description } : {}),
      ...(Object.hasOwn(cmd, 'categoryId') ? { categoryId: cmd.categoryId } : {}),
    } : {}) });
  const base = getFirestore().collection('users').doc(cmd.uid);
  const receiptRef = base.collection('operations').doc(cmd.requestId);
  const summaryRef = base.collection('summaries').doc('current');
  const originalTxnRef = base.collection('transactions').doc(cmd.transactionId);
  const originalEventRef = base.collection('journal').doc(cmd.transactionId);
  const reversalId = `reversal_${cmd.requestId}`;
  const replacementId = `corrected_${cmd.requestId}`;
  const reversalRef = base.collection('journal').doc(reversalId);
  const replacementEventRef = base.collection('journal').doc(replacementId);
  const replacementTxnRef = base.collection('transactions').doc(replacementId);

  return getFirestore().runTransaction(async (tx) => {
    // All reads happen before the first write; summary contention triggers retries.
    const [receiptSnap, summarySnap, txnSnap, eventSnap] = await Promise.all([
      tx.get(receiptRef), tx.get(summaryRef), tx.get(originalTxnRef), tx.get(originalEventRef),
    ]);
    if (receiptSnap.exists) {
      const prior = receiptSnap.data();
      if (prior.fingerprint !== fingerprint) throw new HttpsError('already-exists', 'Conflicting requestId.');
      return { ...prior.result, duplicate: true };
    }
    if (!txnSnap.exists || !eventSnap.exists) throw new HttpsError('not-found', 'Transaction not found.');
    const original = txnSnap.data();
    const oldEvent = eventSnap.data();
    if (!['income', 'expense'].includes(original.eventType) || original.eventType !== oldEvent.eventType) {
      throw new HttpsError('failed-precondition', 'Only original income/expense transactions can be changed.');
    }
    if (original.status === 'reversed' || original.reversedByEventId) {
      throw new HttpsError('failed-precondition', 'Transaction was already reversed or corrected.');
    }
    // PHASE16_BILL_SOURCE_CHECK: also forbid relabeling a corrected ordinary
    // expense as a managed bill expense. This protects the paid/unpaid state.
    const billSourceKeys = [...new Set([original.sourceKey, cmd.sourceKey].filter(
      k => typeof k === 'string' && k.startsWith('bill:')))];
    if (original.billOccurrenceId || oldEvent.billOccurrenceId) {
      throw new HttpsError('failed-precondition', 'Bill-linked transactions require a dedicated correction workflow.');
    }
    if (billSourceKeys.length) {
      const bills = await Promise.all(billSourceKeys.map(k =>
        tx.get(base.collection('billRules').doc(k.slice(5)))));
      if (bills.some(s => s.exists)) {
        throw new HttpsError('failed-precondition', 'Managed bill reserves cannot be modified by generic corrections.');
      }
    }
    if (original.amountCents !== oldEvent.amountCents || !Array.isArray(oldEvent.postings)) {
      throw new HttpsError('failed-precondition', 'Transaction and journal disagree.');
    }

    // PERIOD_CORRECTION_V1: resolve the authoritative budget period and rule before writes.
    // This also serializes corrections with period closure and concurrent spending.
    let linkedPeriod = null;
    let linkedPeriodRef = null;
    if (original.budgetPeriodId) {
      if (original.eventType !== 'expense' ||
          typeof original.budgetPeriodId !== 'string' ||
          !/^[A-Za-z0-9_-]{1,100}_\d{4}-\d{2}-\d{2}$/.test(original.budgetPeriodId)) {
        throw new HttpsError('failed-precondition', 'Invalid linked budget period.');
      }
      const budgetId = original.sourceKey?.startsWith('budget:')
        ? original.sourceKey.slice('budget:'.length) : null;
      if (!budgetId || !original.budgetPeriodId.startsWith(budgetId + '_')) {
        throw new HttpsError('failed-precondition', 'Linked budget source is inconsistent.');
      }
      linkedPeriodRef = base.collection('budgetPeriods').doc(original.budgetPeriodId);
      const ruleRef = base.collection('budgetRules').doc(budgetId);
      const [periodSnap, ruleSnap] = await Promise.all([tx.get(linkedPeriodRef), tx.get(ruleRef)]);
      if (!periodSnap.exists || !ruleSnap.exists) {
        throw new HttpsError('failed-precondition', 'Linked budget or period is missing.');
      }
      linkedPeriod = periodSnap.data();
      if (linkedPeriod.status !== 'open' || linkedPeriod.budgetId !== budgetId ||
          ruleSnap.data().openPeriodId !== original.budgetPeriodId ||
          linkedPeriod.periodId !== original.budgetPeriodId ||
          !Number.isSafeInteger(linkedPeriod.spentCents) || linkedPeriod.spentCents < original.amountCents ||
          !Number.isSafeInteger(linkedPeriod.limitCents) || linkedPeriod.limitCents <= 0 ||
          linkedPeriod.varianceCents !== linkedPeriod.limitCents - linkedPeriod.spentCents ||
          original.effectiveDate < linkedPeriod.startDate ||
          original.effectiveDate >= linkedPeriod.endExclusiveDate) {
        throw new HttpsError('failed-precondition', 'Linked budget period is closed or inconsistent.');
      }
      if (kind === 'correct') {
        if ((cmd.sourceKey ?? original.sourceKey) !== original.sourceKey ||
            cmd.effectiveDate < linkedPeriod.startDate ||
            cmd.effectiveDate >= linkedPeriod.endExclusiveDate ||
            (Object.hasOwn(cmd, 'categoryId') && cmd.categoryId !== original.categoryId)) {
          throw new HttpsError('failed-precondition',
            'Linked expense corrections must stay in the same budget, period and category.');
        }
      }
    }

    let reversal, reversedState, replacement, finalState;
    try {
      const accounts = readAccounts(summarySnap.data(), ledger);
      reversal = ledger.createEvent({ eventId: reversalId, requestId: cmd.requestId,
        eventType: 'reversal', amountCents: original.amountCents,
        effectiveDate: kind === 'correct' ? cmd.effectiveDate : oldEvent.effectiveDate,
        postings: oldEvent.postings.map(({ accountKey, deltaCents }) => ({ accountKey, deltaCents: -deltaCents })) });
      reversedState = ledger.applyEvent({ accounts, receipts: {} }, reversal);
      if (kind === 'correct') {
        replacement = replacementEvent(ledger, cmd, original, reversedState, replacementId);
        finalState = ledger.applyEvent({ accounts: reversedState.accounts, receipts: {} }, replacement);
      } else finalState = reversedState;
    } catch (error) { badInput(error); }

    const updated = ledger.ledgerSummary(finalState);
    const revisedPeriodSpent = linkedPeriod
      ? linkedPeriod.spentCents - original.amountCents + (replacement ? cmd.amountCents : 0)
      : null;
    if (linkedPeriod && (!Number.isSafeInteger(revisedPeriodSpent) || revisedPeriodSpent < 0 ||
        !Number.isSafeInteger(linkedPeriod.limitCents - revisedPeriodSpent))) {
      throw new HttpsError('failed-precondition', 'Corrected period amount is out of range.');
    }
    const result = { reversalEventId: reversalId,
      ...(replacement ? { replacementEventId: replacementId } : {}), ...updated };
    tx.create(reversalRef, { ...reversal, schemaVersion: 1,
      reversesEventId: cmd.transactionId,
      ...(linkedPeriod ? { budgetPeriodId: original.budgetPeriodId } : {}),
      createdAt: FieldValue.serverTimestamp() });
    if (replacement) {
      const sourceKey = original.eventType === 'expense' ? (cmd.sourceKey ?? original.sourceKey) : undefined;
      const description = cmd.description ?? original.description ?? '';
      const categoryId = Object.hasOwn(cmd, 'categoryId') ? cmd.categoryId : original.categoryId ?? null;
      tx.create(replacementEventRef, { ...replacement, schemaVersion: 1,
        correctsEventId: cmd.transactionId, description, categoryId,
        ...(linkedPeriod ? { budgetPeriodId: original.budgetPeriodId } : {}),
        createdAt: FieldValue.serverTimestamp() });
      tx.create(replacementTxnRef, { eventId: replacementId, requestId: cmd.requestId,
        eventType: original.eventType, amountCents: cmd.amountCents, effectiveDate: cmd.effectiveDate,
        ...(sourceKey ? { sourceKey } : {}), description, categoryId,
        correctsTransactionId: cmd.transactionId,
        ...(linkedPeriod ? { budgetPeriodId: original.budgetPeriodId } : {}),
        status: 'active', schemaVersion: 1,
        createdAt: FieldValue.serverTimestamp() });
    }
    if (linkedPeriod) {
      tx.update(linkedPeriodRef, { spentCents: revisedPeriodSpent,
        varianceCents: linkedPeriod.limitCents - revisedPeriodSpent,
        updatedAt: FieldValue.serverTimestamp() });
    }
    tx.update(originalTxnRef, { status: 'reversed', reversedByEventId: reversalId,
      ...(replacement ? { replacedByTransactionId: replacementId } : {}),
      updatedAt: FieldValue.serverTimestamp() });
    tx.update(summaryRef, { ...updated, accounts: finalState.accounts,
      lastEventId: replacement ? replacementId : reversalId, updatedAt: FieldValue.serverTimestamp() });
    tx.create(receiptRef, { requestId: cmd.requestId, fingerprint,
      kind: kind === 'correct' ? 'correctTransaction' : 'reverseTransaction',
      eventId: reversalId, status: 'committed', result,
      createdAt: FieldValue.serverTimestamp() });
    return { ...result, duplicate: false };
  });
}

module.exports = {
  reverseTransaction: (request) => perform(request, 'reverse'),
  correctTransaction: (request) => perform(request, 'correct'),
};

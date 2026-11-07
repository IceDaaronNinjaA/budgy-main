'use strict';

const { HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { pathToFileURL } = require('node:url');
const path = require('node:path');

// This folder is generated from src/domain/ by scripts/sync-domain.cjs.
// It is included inside the Cloud Functions deployment package.
const ledgerPromise = import(pathToFileURL(path.join(__dirname, '../shared/LedgerCalculations.js')).href);
const REQUEST_ID = /^[A-Za-z0-9_-]{1,110}$/;

function authenticatedUid(request) {
  const uid = request.auth?.uid;
  if (typeof uid !== 'string' || !uid) {
    throw new HttpsError('unauthenticated', 'Sign in before changing financial data.');
  }
  return uid;
}

function commandData(request) {
  const data = request.data;
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new HttpsError('invalid-argument', 'Command data must be an object.');
  }
  const { requestId, amountCents, effectiveDate } = data;
  if (typeof requestId !== 'string' || !REQUEST_ID.test(requestId)) {
    throw new HttpsError('invalid-argument', 'requestId must use 1–110 letters, digits, _ or -.');
  }
  return { requestId, amountCents, effectiveDate };
}

function asBadInput(error) {
  if (error instanceof HttpsError) throw error;
  if (error instanceof RangeError || error instanceof TypeError) {
    throw new HttpsError('invalid-argument', error.message);
  }
  throw error;
}

function validateExistingSummary(summary) {
  if (!summary || !Number.isSafeInteger(summary.trackedTotalCents) ||
      !Number.isSafeInteger(summary.unallocatedCents)) {
    throw new HttpsError('failed-precondition', 'Invalid or missing financial summary.');
  }
  // Backward compatibility with the first initializeAccount implementation,
  // whose summary does not yet contain `accounts`.
  const accounts = summary.accounts ?? { unallocated: summary.unallocatedCents };
  if (!accounts || typeof accounts !== 'object' || Array.isArray(accounts)) {
    throw new HttpsError('failed-precondition', 'Malformed stored account balances.');
  }
  return accounts;
}

async function performOperation(request, kind) {
  const uid = authenticatedUid(request);
  const { requestId, amountCents, effectiveDate } = commandData(request);
  const ledger = await ledgerPromise;
  const eventId = `${kind === 'opening' ? 'opening' : 'income'}_${requestId}`;
  let event;
  try {
    const meta = { eventId, requestId, effectiveDate };
    event = kind === 'opening' ? ledger.openingBalance(meta, amountCents)
      : ledger.recordIncome(meta, amountCents);
  } catch (error) {
    asBadInput(error);
  }

  // Include operation kind, amount, and date, not the transient timestamp.
  const fingerprint = JSON.stringify({
    eventType: event.eventType,
    amountCents: event.amountCents,
    effectiveDate: event.effectiveDate,
  });

  const db = getFirestore();
  const base = db.collection('users').doc(uid);
  const operationRef = base.collection('operations').doc(requestId);
  const summaryRef = base.collection('summaries').doc('current');
  const journalRef = base.collection('journal').doc(eventId);
  const transactionRef = kind === 'income' ? base.collection('transactions').doc(eventId) : null;

  return db.runTransaction(async (tx) => {
    // All reads precede writes, and summary is read on every attempt so
    // simultaneous income operations retry rather than lose an update.
    const [receiptSnap, summarySnap] = await Promise.all([
      tx.get(operationRef), tx.get(summaryRef),
    ]);
    if (receiptSnap.exists) {
      const previous = receiptSnap.data();
      if (previous.fingerprint !== fingerprint) {
        throw new HttpsError('already-exists', 'Request ID already used with different data.');
      }
      return { ...previous.result, duplicate: true };
    }
    if (kind === 'opening' && summarySnap.exists) {
      throw new HttpsError('failed-precondition', 'Account already initialized.');
    }
    if (kind !== 'opening' && !summarySnap.exists) {
      throw new HttpsError('failed-precondition', 'Initialize account before recording income.');
    }

    let state;
    try {
      if (kind === 'opening') {
        state = ledger.applyEvent(ledger.emptyLedger(), event);
      } else {
        const previous = summarySnap.data();
        const accounts = validateExistingSummary(previous);
        // Guard that an existing materialized balance has not drifted from
        // the stored summary before modifying it.
        const priorSummary = ledger.ledgerSummary({ accounts, receipts: {} });
        if (priorSummary.trackedTotalCents !== previous.trackedTotalCents ||
            priorSummary.unallocatedCents !== previous.unallocatedCents) {
          throw new HttpsError('failed-precondition', 'Stored summary is inconsistent.');
        }
        state = ledger.applyEvent({ accounts, receipts: {} }, event);
      }
    } catch (error) {
      asBadInput(error);
    }
    const summary = ledger.ledgerSummary(state);
    const result = { eventId, ...summary };
    tx.create(journalRef, { ...event, schemaVersion: 1, createdAt: FieldValue.serverTimestamp() });
    if (transactionRef) {
      tx.create(transactionRef, {
        eventId, requestId, eventType: 'income', amountCents,
        effectiveDate, schemaVersion: 1, createdAt: FieldValue.serverTimestamp(),
      });
    }
    const summaryData = {
      ...summary, accounts: state.accounts,
      lastEventId: eventId, updatedAt: FieldValue.serverTimestamp(),
    };
    if (kind === 'opening') {
      tx.create(summaryRef, { ...summaryData, initializedAt: FieldValue.serverTimestamp() });
    } else {
      tx.update(summaryRef, summaryData);
    }
    tx.create(operationRef, {
      requestId, fingerprint, eventId, status: 'committed', result,
      createdAt: FieldValue.serverTimestamp(),
    });
    return { ...result, duplicate: false };
  });
}

module.exports = {
  initializeAccount: (request) => performOperation(request, 'opening'),
  recordIncome: (request) => performOperation(request, 'income'),
};

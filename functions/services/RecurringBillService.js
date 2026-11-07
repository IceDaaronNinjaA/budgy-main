'use strict';
// Recurring bill definitions, occurrences, reserve funding, and confirmed payment.
// Every mutation uses a per-user idempotency receipt and an atomic Firestore transaction.
const { HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const ledgerPromise = import(pathToFileURL(path.join(__dirname, '../shared/LedgerCalculations.js')).href);
const recurrencePromise = import(pathToFileURL(path.join(__dirname, '../shared/RecurrenceCalculations.js')).href);
const ID = /^[A-Za-z0-9_-]{1,90}$/;
const CAT_ID = /^[A-Za-z0-9_-]{1,128}$/;
const ALLOWED = {
  create: ['requestId','billId','name','amountCents','categoryId','dayOfMonth'],
  update: ['requestId','billId','name','amountCents','categoryId','dayOfMonth'],
  pause: ['requestId','billId','paused'],
  open: ['requestId','billId','month'],
  fund: ['requestId','billId','occurrenceId','amountCents','effectiveDate'],
  pay: ['requestId','billId','occurrenceId','effectiveDate'],
  skip: ['requestId','billId','occurrenceId','effectiveDate'],
};
function bad(error) {
  if (error instanceof HttpsError) throw error;
  if (error instanceof TypeError || error instanceof RangeError) throw new HttpsError('invalid-argument', error.message);
  throw error;
}
function parse(request, action, dates) {
  const uid = request.auth?.uid;
  if (typeof uid !== 'string' || !uid) throw new HttpsError('unauthenticated', 'Sign in first.');
  const value = request.data;
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.keys(value).some(k => !ALLOWED[action].includes(k))) throw new HttpsError('invalid-argument', 'Invalid bill command.');
  for (const field of ['requestId', 'billId']) {
    if (typeof value[field] !== 'string' || !ID.test(value[field])) throw new HttpsError('invalid-argument', `Invalid ${field}.`);
  }
  const cmd = {...value};
  if (action === 'create' || action === 'update') {
    if (typeof cmd.name !== 'string' || !cmd.name.trim() || cmd.name.trim().length > 80) throw new HttpsError('invalid-argument', 'name must be 1–80 characters.');
    cmd.name = cmd.name.trim();
    if (!Number.isSafeInteger(cmd.amountCents) || cmd.amountCents <= 0) throw new HttpsError('invalid-argument', 'amountCents must be positive integer cents.');
    if (typeof cmd.categoryId !== 'string' || !CAT_ID.test(cmd.categoryId)) throw new HttpsError('invalid-argument', 'Invalid categoryId.');
    try { dates.billDueDate('2026-01', cmd.dayOfMonth); } catch(e) { bad(e); }
  }
  if (action === 'pause' && typeof cmd.paused !== 'boolean') throw new HttpsError('invalid-argument', 'paused must be boolean.');
  if (action === 'open') { try { dates.billDueDate(cmd.month, 1); } catch(e) { bad(e); } }
  if (['fund','pay','skip'].includes(action)) {
    if (typeof cmd.occurrenceId !== 'string' || ! /^[A-Za-z0-9_-]{1,90}_\d{4}-(0[1-9]|1[0-2])$/.test(cmd.occurrenceId) ||
        !cmd.occurrenceId.startsWith(`${cmd.billId}_`)) throw new HttpsError('invalid-argument', 'Invalid occurrenceId.');
    try { dates.calendarDate(cmd.effectiveDate); } catch(e) { bad(e); }
    if (action === 'fund' && (!Number.isSafeInteger(cmd.amountCents) || cmd.amountCents <= 0)) throw new HttpsError('invalid-argument', 'Funding must be positive safe-integer cents.');
  }
  return {uid, cmd};
}
function accountsFrom(snapshot, ledger) {
  if (!snapshot.exists) throw new HttpsError('failed-precondition', 'Initialize the account first.');
  const previous = snapshot.data();
  const accounts = previous.accounts;
  if (!accounts || typeof accounts !== 'object' || Array.isArray(accounts) ||
      Object.values(accounts).some(v => !Number.isSafeInteger(v))) throw new HttpsError('failed-precondition', 'Invalid stored accounts.');
  let result;
  try { result = ledger.ledgerSummary({accounts,receipts:{}}); } catch { throw new HttpsError('failed-precondition', 'Inconsistent stored accounts.'); }
  if (Object.entries(result).some(([k,v]) => previous[k] !== v)) throw new HttpsError('failed-precondition', 'Inconsistent stored balance.');
  return accounts;
}
async function perform(request, action) {
  const [ledger,dates] = await Promise.all([ledgerPromise, recurrencePromise]);
  const {uid,cmd} = parse(request, action, dates);
  const db = getFirestore(), base = db.collection('users').doc(uid);
  const ruleRef = base.collection('billRules').doc(cmd.billId);
  const receiptRef = base.collection('operations').doc(cmd.requestId);
  const summaryRef = base.collection('summaries').doc('current');
  const categoryRef = ['create','update'].includes(action) ? base.collection('categories').doc(cmd.categoryId) : null;
  const occurrenceId = action === 'open' ? `${cmd.billId}_${cmd.month}` : cmd.occurrenceId;
  const occurrenceRef = occurrenceId ? base.collection('billOccurrences').doc(occurrenceId) : null;
  const financial = ['fund','pay','skip'].includes(action);
  const eventId = `bill_${action}_${cmd.requestId}`;
  const eventRef = base.collection('journal').doc(eventId);
  const transactionRef = action === 'pay' ? base.collection('transactions').doc(eventId) : null;
  const fingerprint = JSON.stringify({action,...cmd,requestId:undefined});
  return db.runTransaction(async tx => {
    const [receipt, ruleSnap, summarySnap, categorySnap, occurrenceSnap] = await Promise.all([
      tx.get(receiptRef), tx.get(ruleRef), tx.get(summaryRef),
      categoryRef ? tx.get(categoryRef) : Promise.resolve(null),
      occurrenceRef ? tx.get(occurrenceRef) : Promise.resolve(null),
    ]);
    if (receipt.exists) {
      const old = receipt.data();
      if (old.fingerprint !== fingerprint) throw new HttpsError('already-exists', 'Conflicting request ID.');
      return {...old.result, duplicate:true};
    }
    const accounts = accountsFrom(summarySnap, ledger);
    if (action === 'create' && ruleSnap.exists) throw new HttpsError('already-exists', 'Bill ID already exists.');
    if (action !== 'create' && !ruleSnap.exists) throw new HttpsError('not-found', 'Bill rule not found.');
    if (categoryRef && (!categorySnap.exists || categorySnap.data().archived || categorySnap.data().type !== 'expense'))
      throw new HttpsError('failed-precondition', 'An active expense category is required.');
    const rule = ruleSnap.exists ? ruleSnap.data() : null;
    const reserveKey = `bill:${cmd.billId}`;
    const reservedCents = accounts[reserveKey] ?? 0;
    if (!Number.isSafeInteger(reservedCents) || reservedCents < 0) throw new HttpsError('failed-precondition', 'Invalid bill reserve.');
    if (action === 'create' && reservedCents) throw new HttpsError('failed-precondition', 'Bill reserve already contains funds.');
    const activeId = rule?.openOccurrenceId ?? null;
    let result, event, updatedState;
    if (action === 'create') {
      result = {billId:cmd.billId, name:cmd.name, amountCents:cmd.amountCents,
        categoryId:cmd.categoryId, dayOfMonth:cmd.dayOfMonth, paused:false, openOccurrenceId:null};
      tx.create(ruleRef,{...result, schemaVersion:1, createdAt:FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp()});
    } else if (action === 'update') {
      if (activeId) throw new HttpsError('failed-precondition', 'Finish the open occurrence before changing the bill rule.');
      result = {billId:cmd.billId, name:cmd.name, amountCents:cmd.amountCents,
        categoryId:cmd.categoryId, dayOfMonth:cmd.dayOfMonth, paused:rule.paused,openOccurrenceId:null};
      tx.update(ruleRef,{name:cmd.name,amountCents:cmd.amountCents,categoryId:cmd.categoryId,
        dayOfMonth:cmd.dayOfMonth,updatedAt:FieldValue.serverTimestamp()});
    } else if (action === 'pause') {
      result = {billId:cmd.billId,paused:cmd.paused};
      tx.update(ruleRef,{paused:cmd.paused,updatedAt:FieldValue.serverTimestamp()});
    } else if (action === 'open') {
      if (rule.paused) throw new HttpsError('failed-precondition', 'Bill rule is paused.');
      if (activeId) throw new HttpsError('failed-precondition', 'Finish the previous occurrence first.');
      if (reservedCents !== 0) throw new HttpsError('failed-precondition', 'Release existing bill reserve before opening an occurrence.');
      if (occurrenceSnap.exists) throw new HttpsError('already-exists', 'Occurrence already exists.');
      const dueDate = dates.billDueDate(cmd.month,rule.dayOfMonth);
      result = {occurrenceId, billId:cmd.billId, month:cmd.month,dueDate,
        amountCents:rule.amountCents,categoryId:rule.categoryId,name:rule.name,status:'unpaid',fundedCents:0};
      tx.create(occurrenceRef,{...result,schemaVersion:1,createdAt:FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp()});
      tx.update(ruleRef,{openOccurrenceId:occurrenceId,updatedAt:FieldValue.serverTimestamp()});
    } else {
      if (!occurrenceSnap.exists || occurrenceSnap.data().billId !== cmd.billId) throw new HttpsError('not-found', 'Bill occurrence not found.');
      if (activeId !== occurrenceId || occurrenceSnap.data().status !== 'unpaid') throw new HttpsError('failed-precondition', 'Bill occurrence is not currently payable.');
      const occurrence = occurrenceSnap.data();
      const meta = {eventId,requestId:cmd.requestId,effectiveDate:cmd.effectiveDate};
      if (action === 'fund') {
        if (rule.paused) throw new HttpsError('failed-precondition', 'Bill rule is paused.');
        if (cmd.amountCents > occurrence.amountCents - reservedCents) throw new HttpsError('failed-precondition', 'Funding exceeds outstanding bill amount.');
        try {event = ledger.allocate(meta,cmd.amountCents,reserveKey);updatedState=ledger.applyEvent({accounts,receipts:{}},event);}catch(e){bad(e);}
        result = {occurrenceId,billId:cmd.billId,status:'unpaid',reservedCents:updatedState.accounts[reserveKey]};
        tx.update(occurrenceRef,{fundedCents:updatedState.accounts[reserveKey],updatedAt:FieldValue.serverTimestamp()});
      } else if (action === 'pay') {
        if (reservedCents < occurrence.amountCents) throw new HttpsError('failed-precondition', 'Fully fund the bill before confirming payment.');
        try {event=ledger.recordExpense(meta,occurrence.amountCents,reserveKey,reservedCents);updatedState=ledger.applyEvent({accounts,receipts:{}},event);}catch(e){bad(e);}
        result={occurrenceId,billId:cmd.billId,status:'paid',expenseEventId:eventId,paidCents:occurrence.amountCents};
        tx.update(occurrenceRef,{status:'paid',paidAt:FieldValue.serverTimestamp(),paidEffectiveDate:cmd.effectiveDate,
          expenseEventId:eventId,updatedAt:FieldValue.serverTimestamp()});
        tx.update(ruleRef,{openOccurrenceId:FieldValue.delete(),updatedAt:FieldValue.serverTimestamp()});
        tx.create(transactionRef,{eventId,requestId:cmd.requestId,eventType:'expense',amountCents:occurrence.amountCents,
          effectiveDate:cmd.effectiveDate,sourceKey:reserveKey,description:occurrence.name,
          categoryId:occurrence.categoryId,billOccurrenceId:occurrenceId,status:'active',schemaVersion:1,
          createdAt:FieldValue.serverTimestamp()});
      } else {
        result={occurrenceId,billId:cmd.billId,status:'skipped',releasedCents:reservedCents};
        if (reservedCents > 0) {
          try {event=ledger.release(meta,reservedCents,reserveKey);updatedState=ledger.applyEvent({accounts,receipts:{}},event);}catch(e){bad(e);}
        }
        tx.update(occurrenceRef,{status:'skipped',releasedCents:reservedCents,
          skippedAt:FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp()});
        tx.update(ruleRef,{openOccurrenceId:FieldValue.delete(),updatedAt:FieldValue.serverTimestamp()});
      }
      if (event) {
        const computed=ledger.ledgerSummary(updatedState);
        tx.create(eventRef,{...event,billOccurrenceId:occurrenceId,schemaVersion:1,createdAt:FieldValue.serverTimestamp()});
        tx.update(summaryRef,{...computed,accounts:updatedState.accounts,lastEventId:eventId,
          updatedAt:FieldValue.serverTimestamp()});
        result={...result,...computed,eventId};
      }
    }
    tx.create(receiptRef,{requestId:cmd.requestId,fingerprint,kind:`bill_${action}`,status:'committed',
      eventId: event ? eventId : null, result,createdAt:FieldValue.serverTimestamp()});
    return {...result,duplicate:false};
  });
}
module.exports = {
  createBillRule:req=>perform(req,'create'),
  updateBillRule:req=>perform(req,'update'),
  setBillPaused:req=>perform(req,'pause'),
  openBillOccurrence:req=>perform(req,'open'),
  fundBillOccurrence:req=>perform(req,'fund'),
  confirmBillPayment:req=>perform(req,'pay'),
  skipBillOccurrence:req=>perform(req,'skip'),
};

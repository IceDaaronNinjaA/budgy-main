'use strict';
// Metadata lifecycle only. Financial funding/spending and closure are separate
// operations and must not be implied by creating a budget or a period.
const { HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const calculations = import(pathToFileURL(path.join(__dirname, '../shared/BudgetCalculations.js')).href);
const ID = /^[A-Za-z0-9_-]{1,100}$/;
const CATEGORY_ID = /^[A-Za-z0-9_-]{1,128}$/;
const NAME_MAX = 80;

function input(request, action) {
  const uid = request.auth?.uid;
  if (typeof uid !== 'string' || !uid) throw new HttpsError('unauthenticated', 'Sign in first.');
  const data = request.data;
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new HttpsError('invalid-argument', 'Command data must be an object.');
  const keys = {
    create: ['requestId','budgetId','name','categoryId','limitCents','frequency'],
    update: ['requestId','budgetId','name','categoryId','limitCents'],
    pause: ['requestId','budgetId','paused'],
    open: ['requestId','budgetId','effectiveDate'],
  }[action];
  if (Object.keys(data).some(k => !keys.includes(k))) throw new HttpsError('invalid-argument', 'Unknown command field.');
  if (typeof data.requestId !== 'string' || !ID.test(data.requestId)) throw new HttpsError('invalid-argument', 'Invalid requestId.');
  if (typeof data.budgetId !== 'string' || !ID.test(data.budgetId)) throw new HttpsError('invalid-argument', 'Invalid budgetId.');
  if (['create','update'].includes(action)) {
    if (typeof data.name !== 'string' || !data.name.trim() || data.name.trim().length > NAME_MAX) throw new HttpsError('invalid-argument', 'name must be 1-80 characters.');
    if (typeof data.categoryId !== 'string' || !CATEGORY_ID.test(data.categoryId)) throw new HttpsError('invalid-argument', 'Invalid categoryId.');
    if (!Number.isSafeInteger(data.limitCents) || data.limitCents <= 0) throw new HttpsError('invalid-argument', 'limitCents must be positive safe-integer cents.');
  }
  if (action === 'create' && !['weekly','monthly'].includes(data.frequency)) throw new HttpsError('invalid-argument', 'Invalid frequency.');
  if (action === 'pause' && typeof data.paused !== 'boolean') throw new HttpsError('invalid-argument', 'paused must be boolean.');
  if (action === 'open' && typeof data.effectiveDate !== 'string') throw new HttpsError('invalid-argument', 'effectiveDate required.');
  return { uid, action, data: { ...data, ...(data.name !== undefined ? { name: data.name.trim() } : {}) } };
}

async function perform(request, action) {
  const { uid, data } = input(request, action);
  const calc = await calculations;
  let period;
  if (action === 'open') {
    try { calc.calendarDay(data.effectiveDate); }
    catch (e) { throw new HttpsError('invalid-argument', e.message); }
  }
  const base = getFirestore().collection('users').doc(uid);
  const ruleRef = base.collection('budgetRules').doc(data.budgetId);
  const receiptRef = base.collection('operations').doc(data.requestId);
  const categoryRef = ['create','update'].includes(action) ? base.collection('categories').doc(data.categoryId) : null;
  const fingerprint = JSON.stringify({ action, ...data, requestId: undefined });
  return getFirestore().runTransaction(async tx => {
    // All reads first. Period reference depends on stored frequency.
    const [receipt, rule, category] = await Promise.all([
      tx.get(receiptRef), tx.get(ruleRef), categoryRef ? tx.get(categoryRef) : Promise.resolve(null),
    ]);
    if (receipt.exists) {
      const prev = receipt.data();
      if (prev.fingerprint !== fingerprint) throw new HttpsError('already-exists', 'Conflicting requestId.');
      return { ...prev.result, duplicate: true };
    }
    if (action === 'create' && rule.exists) throw new HttpsError('already-exists', 'Budget ID already exists.');
    if (action !== 'create' && !rule.exists) throw new HttpsError('not-found', 'Budget not found.');
    if (categoryRef && (!category.exists || category.data().archived || category.data().type !== 'expense')) {
      throw new HttpsError('failed-precondition', 'Category must exist, be active, and be an expense category.');
    }
    let result, periodRef;
    if (action === 'open') {
      if (rule.data().paused) throw new HttpsError('failed-precondition', 'Budget is paused.');
      period = calc.periodForDate(rule.data().frequency, data.effectiveDate);
      // Firestore document ID is at most 100+1+10 = 111 characters.
      const periodId = `${data.budgetId}_${period.startDate}`;
      periodRef = base.collection('budgetPeriods').doc(periodId);
      const existing = await tx.get(periodRef);
      if (existing.exists) throw new HttpsError('already-exists', 'Period already exists.');
      result = { periodId, budgetId: data.budgetId, ...period, limitCents: rule.data().limitCents,
        spentCents: 0, varianceCents: rule.data().limitCents, status: 'open' };
    } else if (action === 'create') {
      result = { budgetId: data.budgetId, name: data.name, categoryId: data.categoryId,
        limitCents: data.limitCents, frequency: data.frequency, paused: false };
    } else if (action === 'update') {
      result = { budgetId: data.budgetId, name: data.name, categoryId: data.categoryId,
        limitCents: data.limitCents, frequency: rule.data().frequency, paused: rule.data().paused };
    } else {
      result = { budgetId: data.budgetId, name: rule.data().name, categoryId: rule.data().categoryId,
        limitCents: rule.data().limitCents, frequency: rule.data().frequency, paused: data.paused };
    }
    if (action === 'create') tx.create(ruleRef, { ...result, schemaVersion: 1, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
    if (action === 'update') tx.update(ruleRef, { name: data.name, categoryId: data.categoryId, limitCents: data.limitCents, updatedAt: FieldValue.serverTimestamp() });
    if (action === 'pause') tx.update(ruleRef, { paused: data.paused, updatedAt: FieldValue.serverTimestamp() });
    if (action === 'open') tx.create(periodRef, { ...result, schemaVersion: 1, createdAt: FieldValue.serverTimestamp() });
    tx.create(receiptRef, { requestId: data.requestId, fingerprint, kind: `budget_${action}`,
      status: 'committed', result, createdAt: FieldValue.serverTimestamp() });
    return { ...result, duplicate: false };
  });
}
module.exports = {
  createBudgetRule: req => perform(req, 'create'),
  updateBudgetRule: req => perform(req, 'update'),
  setBudgetPaused: req => perform(req, 'pause'),
  openBudgetPeriod: req => perform(req, 'open'),
};

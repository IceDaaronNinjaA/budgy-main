'use strict';

const { HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

const ID = /^[A-Za-z0-9_-]{1,110}$/;
const CATEGORY_ID = /^[A-Za-z0-9_-]{1,128}$/;
const TYPES = new Set(['income', 'expense']);

function input(request, action) {
  const uid = request.auth?.uid;
  if (typeof uid !== 'string' || !uid) {
    throw new HttpsError('unauthenticated', 'Sign in to manage categories.');
  }
  const data = request.data;
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new HttpsError('invalid-argument', 'Command data must be an object.');
  }
  const fields = action === 'create'
    ? ['requestId', 'categoryId', 'name', 'type']
    : action === 'update'
      ? ['requestId', 'categoryId', 'name']
      : ['requestId', 'categoryId'];
  if (Object.keys(data).some((key) => !fields.includes(key))) {
    throw new HttpsError('invalid-argument', 'Unrecognized category command field.');
  }
  if (typeof data.requestId !== 'string' || !ID.test(data.requestId)) {
    throw new HttpsError('invalid-argument', 'Invalid requestId.');
  }
  if (typeof data.categoryId !== 'string' || !CATEGORY_ID.test(data.categoryId)) {
    throw new HttpsError('invalid-argument', 'Invalid categoryId.');
  }
  if (action === 'create' && !TYPES.has(data.type)) {
    throw new HttpsError('invalid-argument', 'type must be income or expense.');
  }
  let name;
  if (action !== 'archive') {
    if (typeof data.name !== 'string' || data.name.trim().length < 1 || data.name.trim().length > 80) {
      throw new HttpsError('invalid-argument', 'name must be 1–80 nonblank characters.');
    }
    name = data.name.trim();
  }
  return { uid, requestId: data.requestId, categoryId: data.categoryId,
    ...(name === undefined ? {} : { name }),
    ...(action === 'create' ? { type: data.type } : {}) };
}

async function perform(request, action) {
  const command = input(request, action);
  const { uid, requestId, categoryId } = command;
  const fingerprint = JSON.stringify({ action, categoryId,
    ...(command.name === undefined ? {} : { name: command.name }),
    ...(command.type === undefined ? {} : { type: command.type }) });
  const base = getFirestore().collection('users').doc(uid);
  const categoryRef = base.collection('categories').doc(categoryId);
  const receiptRef = base.collection('operations').doc(requestId);
  return getFirestore().runTransaction(async (tx) => {
    const [receiptSnap, categorySnap] = await Promise.all([tx.get(receiptRef), tx.get(categoryRef)]);
    if (receiptSnap.exists) {
      const prior = receiptSnap.data();
      if (prior.fingerprint !== fingerprint) {
        throw new HttpsError('already-exists', 'Request ID already used with different data.');
      }
      return { ...prior.result, duplicate: true };
    }
    let result;
    if (action === 'create') {
      if (categorySnap.exists) throw new HttpsError('already-exists', 'Category ID already exists.');
      tx.create(categoryRef, { categoryId, name: command.name, type: command.type,
        archived: false, schemaVersion: 1,
        createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
      result = { categoryId, name: command.name, type: command.type, archived: false };
    } else {
      if (!categorySnap.exists) throw new HttpsError('not-found', 'Category not found.');
      const existing = categorySnap.data();
      if (existing.archived) throw new HttpsError('failed-precondition', 'Category is archived.');
      if (action === 'update') {
        tx.update(categoryRef, { name: command.name, updatedAt: FieldValue.serverTimestamp() });
        result = { categoryId, name: command.name, type: existing.type, archived: false };
      } else {
        tx.update(categoryRef, { archived: true, archivedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp() });
        result = { categoryId, name: existing.name, type: existing.type, archived: true };
      }
    }
    tx.create(receiptRef, { requestId, fingerprint, kind: `category_${action}`,
      categoryId, status: 'committed', result, createdAt: FieldValue.serverTimestamp() });
    return { ...result, duplicate: false };
  });
}

module.exports = {
  createCategory: (request) => perform(request, 'create'),
  updateCategory: (request) => perform(request, 'update'),
  archiveCategory: (request) => perform(request, 'archive'),
};

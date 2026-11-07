'use strict';
// Explicit opt-in. User-owned settings are written only by an authenticated callable.
const { HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const ID = /^[A-Za-z0-9_-]{1,90}$/;

function dateInZone(date, timeZone) {
  if (!(date instanceof Date) || !Number.isFinite(date.getTime())) throw new TypeError('Invalid instant.');
  const pieces = new Intl.DateTimeFormat('en-US', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const part = (type) => pieces.find(x => x.type === type)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}
function validateTimeZone(value) {
  if (typeof value !== 'string' || value.length > 100 || !/^[A-Za-z0-9_+\/-]+$/.test(value)) {
    throw new HttpsError('invalid-argument', 'timeZone must be an IANA time zone.');
  }
  try { dateInZone(new Date(), value); }
  catch { throw new HttpsError('invalid-argument', 'Unknown timeZone.'); }
  return value;
}
async function setFinancialAutomationSettings(request) {
  const uid = request.auth?.uid;
  if (typeof uid !== 'string' || !uid) throw new HttpsError('unauthenticated', 'Sign in first.');
  const cmd = request.data;
  if (!cmd || typeof cmd !== 'object' || Array.isArray(cmd) ||
      Object.keys(cmd).some(k => !['requestId','enabled','timeZone'].includes(k)) ||
      typeof cmd.requestId !== 'string' || !ID.test(cmd.requestId) ||
      typeof cmd.enabled !== 'boolean') {
    throw new HttpsError('invalid-argument', 'Invalid automation settings.');
  }
  const timeZone = validateTimeZone(cmd.timeZone);
  const base = getFirestore().collection('users').doc(uid);
  const settingsRef = base.collection('settings').doc('financialAutomation');
  const receiptRef = base.collection('operations').doc(cmd.requestId);
  const summaryRef = base.collection('summaries').doc('current');
  const fingerprint = JSON.stringify({kind:'setFinancialAutomationSettings',enabled:cmd.enabled,timeZone});
  return getFirestore().runTransaction(async tx => {
    const [receipt,summary] = await Promise.all([tx.get(receiptRef),tx.get(summaryRef)]);
    if (receipt.exists) {
      if (receipt.data().fingerprint !== fingerprint) throw new HttpsError('already-exists', 'Request ID conflict.');
      return {...receipt.data().result,duplicate:true};
    }
    if (!summary.exists) throw new HttpsError('failed-precondition', 'Initialize account first.');
    const result = {enabled:cmd.enabled,timeZone};
    tx.set(settingsRef,{...result,schemaVersion:1,updatedAt:FieldValue.serverTimestamp()},{merge:true});
    tx.create(receiptRef,{requestId:cmd.requestId,fingerprint,kind:'automation_settings',status:'committed',result,
      createdAt:FieldValue.serverTimestamp()});
    return {...result,duplicate:false};
  });
}
module.exports = {setFinancialAutomationSettings,dateInZone};

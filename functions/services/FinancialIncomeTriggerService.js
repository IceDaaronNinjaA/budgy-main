'use strict';
// Triggered only by genuine income journal entries, not reserve transfers.
// Reconciliation is repeat-safe. Failures are logged; clients can re-invoke
// reconcileFinancialSchedule at startup/resume (or after an error).
const { getFirestore } = require('firebase-admin/firestore');
const { reconcileFinancialSchedule } = require('./FinancialReconciliationService');

async function onIncomeJournalCreated(event) {
  const uid=event.params?.uid;
  const value=event.data?.data();
  if (!uid || !value || value.eventType !== 'income') return;
  const settings = await getFirestore().collection('users').doc(uid)
    .collection('settings').doc('financialAutomation').get();
  if (!settings.exists || settings.data().enabled !== true) return;
  const result=await reconcileFinancialSchedule({auth:{uid},data:{}});
  if (result.partial) {
    // A startup reconciliation can retry these cases after the user opens the app.
    console.warn('Budgy income reconciliation partially failed',uid,result.lifecycle.filter(r=>r.action==='error'));
  }
}
module.exports={onIncomeJournalCreated};

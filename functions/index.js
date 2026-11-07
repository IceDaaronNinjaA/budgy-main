'use strict';
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
// PHASE16_AUTOMATION_SETTINGS
const reconciliation = require('./services/FinancialReconciliationService');
const { initializeApp } = require('firebase-admin/app');
const automationSettings = require('./services/FinancialAutomationSettingsService');
const incomeTrigger = require('./services/FinancialIncomeTriggerService');
const operations = require('./services/FinancialOperationsService');
const savings = require('./services/SavingsGoalService');
const bills = require('./services/RecurringBillService');
const funding = require('./services/AutomaticFundingService');
const categories = require('./services/CategoryManagementService');
const corrections = require('./services/TransactionCorrectionService');
const budgets = require('./services/BudgetManagementService');
const periodClose = require('./services/BudgetPeriodClosureService');

initializeApp();
// Opted-in users only. Income journal entries trigger reconciliation, never
// bill payments or reserve transfers.
exports.incomeFundingTrigger = onDocumentCreated(
  { document: 'users/{uid}/journal/{eventId}', region: 'us-central1', retry: false },
  incomeTrigger.onIncomeJournalCreated
);
const options = { region: 'us-central1' };
exports.setFinancialAutomationSettings = onCall(options, automationSettings.setFinancialAutomationSettings);
exports.reconcileFinancialSchedule = onCall(options, reconciliation.reconcileFinancialSchedule);

exports.backendHealthCheck = onCall(options, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'You must be signed in.');
  return { status: 'ok', service: 'budgy-financial-backend', authenticated: true };
});
for (const [name, handler] of Object.entries(operations)) {
  exports[name] = onCall(options, handler);
}

for (const [name, handler] of Object.entries(categories)) {
  exports[name] = onCall(options, handler);
}

for (const [name, handler] of Object.entries(corrections)) {
  exports[name] = onCall(options, handler);
}

for (const [name, handler] of Object.entries(budgets)) {
  exports[name] = onCall(options, handler);
}
for (const [name, handler] of Object.entries(periodClose)) {
  exports[name] = onCall(options, handler);
}

for (const [name, handler] of Object.entries(savings)) {
  exports[name] = onCall(options, handler);
}
for (const [name, handler] of Object.entries(bills)) {
  exports[name] = onCall(options, handler);
}

for (const [name, handler] of Object.entries(funding)) {
  exports[name] = onCall(options, handler);
}

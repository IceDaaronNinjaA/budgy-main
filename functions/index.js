'use strict';
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { initializeApp } = require('firebase-admin/app');
const operations = require('./services/FinancialOperationsService');
const categories = require('./services/CategoryManagementService');
const corrections = require('./services/TransactionCorrectionService');
const budgets = require('./services/BudgetManagementService');

initializeApp();
const options = { region: 'us-central1' };

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

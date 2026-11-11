# Add Transactions implementation

This change adds the Add Transaction flow to the existing Expo Router app.

## What changed

- `src/screens/AddTransactionScreen.jsx`: income/expense form, amount/date/description validation, user-scoped category selection and creation, expense funding-source selection, loading/success/error states.
- `src/app/add-transaction.js`: route entrypoint for the new screen.
- `src/components/ui/navBar.js`: connects the center `+` button to `/add-transaction` by default.
- `src/components/AppTabs.js`: registers the route as a hidden tab destination.
- `src/services/TransactionService.js`: uses the existing `recordIncome`, `recordExpense`, and `createCategory` callable Cloud Functions; reads categories, balances, budget periods, budgets, goals, and transaction history under the signed-in user's UID.

## Requirements addressed

- FR-TXN-001: manually add income with amount, date, description, and optional category.
- FR-TXN-002: manually add expenses with amount, date, description, category, and funding source.
- FR-TXN-003: supports unallocated funds, open budget reserves, and savings-goal reserves. Managed bill reserves are intentionally routed through the bill-payment workflow because the backend rejects generic bill-reserve expenses to prevent duplicate bill payments.
- FR-TXN-004 and FR-TXN-005: the UI calls the trusted financial backend, which atomically updates the journal and summary.
- Idempotency: the screen reuses the same request ID when retrying an unchanged submission.

This implements the **create** portion of the transaction flow. Transaction history filtering, editing, correction, and reversal remain separate work under FR-TXN-006 and FR-TXN-007.

## Important runtime assumptions

- The user must be signed in and have an initialized tracked account (`users/{uid}/summaries/current`).
- The callable Cloud Functions `recordIncome`, `recordExpense`, and `createCategory` must be deployed in `us-central1`.
- The Firestore rules must permit authenticated owners to read their own user subcollections; financial writes remain backend-only.
- Categories are stored at `users/{uid}/categories`. Old top-level seed categories are not read by this implementation.

## Checks

- TypeScript parser/transpiler syntax check passed for all five changed JavaScript/JSX files.
- `npm run lint` could not run in the packaging environment because dependencies were not installed (`expo: not found`). The attempted dependency install timed out; no dependency or lockfile changes were made.

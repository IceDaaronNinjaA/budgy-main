# Budgy — Financial Backend API (v1, emulator-tested)

**Implementation:** `functions/index.js` → `functions/services/FinancialOperationsService.js` on branch `feature/financial-foundation` (reviewed at `25ed6f6`).

**Scope:** This document describes the **currently implemented** callable financial operations. It is not a claim that the entire product requirements specification is complete. No frontend integration or production deployment has been verified.

## Calling convention

All operations are Firebase **HTTPS callable functions (v2)** in region `us-central1`. Each requires a signed-in Firebase Authentication user. The backend determines the target UID exclusively from the verified Firebase authentication context; the client must not choose a target UID.

For a future React Native client using the Firebase Functions SDK, the conceptual call is:

```js
const result = await httpsCallable(functions, 'recordIncome')({
  requestId: 'paycheck_20261106_1',
  amountCents: 75000,
  effectiveDate: '2026-11-06',
});
console.log(result.data);
```

The frontend needs to initialize its Firebase SDK and authenticate the user before making calls; that integration is **not implemented in this backend branch**. During local development, connect the client to the Auth emulator (`127.0.0.1:9099`) and Functions emulator (`127.0.0.1:5001`) and use Firebase project ID `demo-budgy`. On a physical device, `127.0.0.1` points to the **device**, not the development computer: use the appropriate reachable host and configure emulator networking accordingly. The Firestore emulator listens on `127.0.0.1:8080` on the development host.

Do **not** treat these local addresses or `demo-budgy` as production settings.

## Common request contract

Every command requires:

| Field | Type | Rule |
| --- | --- | --- |
| `requestId` | string | Unique per authenticated user and logical command; 1–110 characters, letters, digits, `_` or `-`. Generate once and reuse **the same ID** if retrying the same command. |
| `amountCents` | number | Safe integer cents. Opening balance permits zero; other operations require a positive amount. Never send floating-point dollars. |
| `effectiveDate` | string | A valid calendar date in `YYYY-MM-DD` format, representing the user's intended effective date. |

Commands reject unrecognized fields. `sourceKey` and `destinationKey` are accepted only where specified below. **User IDs supplied in the payload are not an authorization mechanism and are not accepted command fields.**

### Account-key conventions

| Key | Meaning |
| --- | --- |
| `unallocated` | Money not reserved for a budget, bill, or savings goal |
| `budget:{id}` | Funded spending-budget reserve, e.g. `budget:groceries` |
| `bill:{id}` | Funded bill reserve, e.g. `bill:rent` |
| `goal:{id}` | Funded savings reserve, e.g. `goal:emergency_fund` |
| `external` | Journal balancing counteraccount; **not** a valid internal funding source/destination |

Reserve IDs use letters, digits, `_` and `-` (1–128 characters). **These account keys represent balances; the current API does not create named budget rules, bill schedules, or savings goal metadata.** The client must not mistake existence of a reserve balance for existence of a complete budget/goal/bill record.

## Implemented callable functions

| Function | Additional fields | Effect on tracked total | Preconditions |
| --- | --- | --- | --- |
| `initializeAccount` | None | Sets tracked total to opening amount | Must not already have an initialized account; zero allowed |
| `recordIncome` | None | Increases tracked total by amount | Account initialized; amount > 0 |
| `recordExpense` | `sourceKey` | Decreases tracked total by amount | Account initialized; valid internal source; goal and bill reserves must have enough funds |
| `allocateFunds` | `destinationKey` | Unchanged | Account initialized; destination a budget/bill/goal reserve; adequate unallocated funds |
| `releaseFunds` | `sourceKey` | Unchanged | Account initialized; source a funded budget/bill/goal reserve; enough funds |
| `transferFunds` | `sourceKey`, `destinationKey` | Unchanged | Account initialized; distinct valid internal accounts; no forbidden reserve overdraft |
| `backendHealthCheck` | None | Unchanged | Authenticated; returns service status only |

`recordExpense` permits `sourceKey: 'unallocated'`. An expense charged to a budget consumes its available budget reserve first, then consumes unallocated funds for any excess. This may leave **unallocated** negative; the backend does not fabricate money to cover it. An expense charged to a goal or bill reserve requires enough funds in that reserve.

### Sample requests

Initialize with $1,500:

```json
{ "requestId": "opening_001", "amountCents": 150000, "effectiveDate": "2026-11-06" }
```

Record $750 income:

```json
{ "requestId": "paycheck_001", "amountCents": 75000, "effectiveDate": "2026-11-06" }
```

Reserve $500 for groceries:

```json
{ "requestId": "groceries_funding_001", "amountCents": 50000, "effectiveDate": "2026-11-06", "destinationKey": "budget:groceries" }
```

Spend $75 from groceries:

```json
{ "requestId": "groceries_purchase_001", "amountCents": 7500, "effectiveDate": "2026-11-06", "sourceKey": "budget:groceries" }
```

Return $20 from groceries to unallocated:

```json
{ "requestId": "groceries_release_001", "amountCents": 2000, "effectiveDate": "2026-11-06", "sourceKey": "budget:groceries" }
```

Move $10 from groceries to savings:

```json
{ "requestId": "groceries_to_goal_001", "amountCents": 1000, "effectiveDate": "2026-11-06", "sourceKey": "budget:groceries", "destinationKey": "goal:emergency_fund" }
```

### Successful response

Financial functions return an object like:

```json
{
  "eventId": "income_paycheck_001",
  "trackedTotalCents": 225000,
  "unallocatedCents": 225000,
  "budgetReserveCents": 0,
  "billReserveCents": 0,
  "savingsReserveCents": 0,
  "duplicate": false
}
```

`eventId` is generated as `<operation-prefix>_<requestId>` (e.g. `opening_opening_001`, `allocate_groceries_funding_001`). `duplicate: true` indicates an identical command was already committed and the **original stored result** was returned; that result is not necessarily the user's current/latest balance if other transactions occurred subsequently. Read `users/{uid}/summaries/current` for the latest materialized balance.

`backendHealthCheck` instead returns:

```json
{ "status": "ok", "service": "budgy-financial-backend", "authenticated": true }
```

## Persistence and access control

Each successful financial command runs inside one Firestore transaction, writing:

- `users/{uid}/journal/{eventId}`: immutable event with balanced journal postings and server timestamp.
- `users/{uid}/operations/{requestId}`: idempotency receipt containing command fingerprint and original result.
- `users/{uid}/summaries/current`: authoritative materialized account balances and aggregate reserve totals.
- `users/{uid}/transactions/{eventId}`: query-friendly history entry **for income and expenses only**.

The summary includes `accounts`, a map of internal account keys to integer-cent balances; plus `trackedTotalCents`, `unallocatedCents`, `budgetReserveCents`, `billReserveCents`, `savingsReserveCents`, `lastEventId`, and timestamps.

The current `firestore.rules` permits an authenticated user to **read** their own user document and nested data, but denies all direct client writes. Only the trusted Admin SDK service writes financial records. Client code should invoke callable functions for all financial mutations.

Do not use the repository's older top-level collections (`transactions`, `goals`, `categories`) as if they were part of this new contract. No migration or production-data reconciliation is included in this branch.

## Idempotency, validation, and errors

- One `requestId` per logical operation per user. Replaying identical arguments returns `duplicate: true` without another journal write. Reusing an ID with different arguments returns an error.
- The service reads the current summary and operation receipt in each Firestore transaction; concurrent updates to the same summary are retried rather than silently overwriting each other, subject to Firestore retry limits.
- Error codes include `unauthenticated` (no authenticated user), `invalid-argument` (bad request or invalid financial input), `already-exists` (conflicting request ID), and `failed-precondition` (e.g. uninitialized account or second opening). Do not rely on a specific HTTP status; use the Firebase callable SDK error code.
- Handle network failures by retrying with **the same request ID**, rather than generating a new one. Display validation and insufficient-funds errors to the user.
- This API does not offer a mutation endpoint to edit, reverse, or delete existing financial events. Corrections need dedicated audited reversal/adjustment operations, not direct journal edits.

## Running and testing locally (Windows CMD)

From the repository root, make sure Java 21 is available to the Firestore emulator and run:

```cmd
cd functions
npm ci
npm run sync-domain
cd ..
npx firebase-tools emulators:start --only auth,firestore,functions --project demo-budgy
```

Leave the emulators running, then in a second Command Prompt:

```cmd
node --test tests\FinancialFoundation.test.js
node --test tests\FirestoreSecurity.test.cjs
node --test tests\FinancialPersistence.test.cjs
node --test tests\IncomePersistence.test.cjs
node --test tests\SpendingPersistence.test.cjs
```

Some tests intentionally cause `PERMISSION_DENIED` logs. Local Firebase metadata lookup and ESM module-type warnings are currently non-blocking. Emulator tests do not certify production security or deployment.

## Known gaps before claiming full Budgy MVP readiness

- Firebase client sign-up/login/logout and frontend-to-callable wiring are not implemented in this branch.
- No creation/editing of named categories or budget rules, weekly/monthly budget periods, budget limits/variance, recurring funding priorities, or period reset-and-release automation.
- No savings goal metadata, deadlines, pace/on-track computations, or goal lifecycle endpoints. `goal:{id}` presently means only a funded reserve.
- No recurring bill definitions, occurrence scheduling, or payment-confirmation lifecycle. `bill:{id}` presently means only a funded reserve.
- No audited corrections/reversals or financial transaction edits/deletes.
- No deployed backend, approved live rules, production-data migration, or tested physical-device authentication integration.
- Dependency audit findings and additional production hardening need review. In particular, Firestore rules currently deny client writes to **all** collections, including user profiles; onboarding must use a trusted path or be handled through carefully reviewed rules changes.
- The backend currently has no rate limiting or operational monitoring configured. Treat all financial data as user-entered values, not bank-verified balances.

**Release guidance:** Suitable for a PR described as a **backend financial foundation**, with outstanding MVP scope explicitly disclosed. Not suitable to describe as a complete production-ready Budgy application.

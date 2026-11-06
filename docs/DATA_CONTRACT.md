# Budgy financial data contract — foundation proposal

**Status:** Proposed implementation contract for `BUDGY_REQUIREMENTS.md` §§4, 6, 11, 14–16. Review with the team before enabling production writes. The requirements document remains authoritative.

## Ownership and collections

New financial data belongs in authenticated per-user paths. Never use a UID passed from an untrusted screen as authorization.

```text
users/{uid}                             # profile and onboarding
users/{uid}/journal/{eventId}            # immutable financial event
users/{uid}/operations/{requestId}       # unique receipt, atomic with journal
users/{uid}/transactions/{transactionId} # query-friendly history
users/{uid}/categories/{categoryId}
users/{uid}/budgetRules/{budgetRuleId}
users/{uid}/budgetPeriods/{periodId}
users/{uid}/savingsGoals/{goalId}
users/{uid}/billRules/{billRuleId}
users/{uid}/billOccurrences/{occurrenceId}
users/{uid}/fundingRules/{fundingRuleId}
users/{uid}/summaries/{summaryId}        # optional, derived from journal
```

These paths are **not yet deployed**. Existing Firestore service files still use the top-level `transactions`, `goals`, `categories`, and `users` collections. **Do not silently repoint them**: first inventory existing data in the authorized environment and plan a migration or explicit development-only reset. Preserve historical entries and IDs as appropriate.

## Money and events

- Monetary fields are **signed safe-integer cents**, USD for MVP. Positive magnitude fields (such as `amountCents`) reject negative numbers; postings can be negative.
- `effectiveDate` is `YYYY-MM-DD` in the user's configured time zone; `createdAt` is a Firestore server timestamp.
- Each event carries stable `eventId`, `requestId`, `eventType`, `schemaVersion: 1`, `amountCents`, `effectiveDate`, optional related IDs, and balanced `postings`.
- Allowed internal posting keys: `unallocated`, `budget:{id}`, `bill:{id}`, `goal:{id}`. The `external` account balances money entering/leaving tracked funds.
- Posting sums must equal **zero including external**. `trackedTotalCents` equals the sum of *internal* account balances: unallocated + budget + bill + goal reserves.
- Event types include `opening_balance`, `income`, `expense`, `allocate`, `release`, `transfer`, `adjustment`, and `reversal`. Foundation code implements the first six; correction/reversal and period/recurrence orchestration remain follow-up work.
- `budgetLimitCents - spentCents` is **variance**, not the funded reserve. The journal's reserve is separate from the budget limit. The initial domain module models reserve movement, **not** a complete budget-period variance engine.
- A budget expense exhausts its reserve then consumes unallocated funds (which may go negative). Goal/bill purchases require explicit adequate reserves in the initial module; changes to this policy require team review.

### Example journal record

```json
{
  "schemaVersion": 1,
  "eventType": "allocate",
  "amountCents": 2000,
  "effectiveDate": "2026-11-06",
  "requestId": "stable-client-generated-id",
  "postings": [
    { "accountKey": "unallocated", "deltaCents": -2000 },
    { "accountKey": "goal:emergency_fund", "deltaCents": 2000 }
  ]
}
```

This is illustrative; real records also need the event's stable ID, ownership context, server timestamp, and relevant entity IDs.

## Trusted write boundary (not yet implemented)

Pure JavaScript functions validate shape and perform deterministic calculations; **they are not an authorization mechanism**. Before live persistence:

1. Build Firebase Auth registration/login/logout, derive UID from the authenticated session, and fail closed without one.
2. Decide whether financial commands run in a trusted Cloud Function (recommended for invariant enforcement) or through a narrowly constrained rules-validated client transaction model. Firestore rules alone cannot generally establish arbitrary balanced journal posting correctness.
3. Implement `runTransaction` to atomically read authoritative state, verify ownership, validate command/preconditions, create journal entry, create `operations/{requestId}` receipt, and update allowed summaries. A repeated identical request returns its recorded result, conflicting reuses fail.
4. Deploy and emulator-test Firestore rules. Deny cross-user read/write; reject untrusted arbitrary journal/posting writes.
5. Confirm migration policy for existing top-level data; do not execute the repository's current `npm run seed` against production.
6. Test offline failures, concurrent funds allocation, race conditions, and exactly-once behavior before claiming financial persistence complete.

## Scope of this first foundation PR

- New pure, testable cents and journal modules under `src/domain/`.
- Native Node test runner coverage for accounting examples.
- This shared contract for implementation teams.
- **No** Firestore writes, authentication migration, deployed security rules, or screen changes in this PR. Those are the next integration milestones, not silently completed features.

import { assertCents, safeCentsSum } from './MoneyCalculations.js';

// Journal postings balance to zero including external; only internal account
// keys contribute to tracked money. This module does NOT write Firestore.
export const EXTERNAL = 'external';
export const UNALLOCATED = 'unallocated';
const DESTINATION_TYPES = new Set(['budget', 'bill', 'goal']);
const VALID_EVENT_TYPES = new Set([
  'opening_balance', 'income', 'expense', 'allocate', 'release', 'transfer',
  'reversal',
]);

export function reserveAccount(type, id) {
  if (!DESTINATION_TYPES.has(type)) throw new RangeError(`Invalid reserve type: ${type}`);
  if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(id)) {
    throw new TypeError('Reserve ID must contain only letters, digits, _ or - (1–128 characters)');
  }
  return `${type}:${id}`;
}

function isAccountKey(key) {
  return key === EXTERNAL || key === UNALLOCATED ||
    (typeof key === 'string' && /^(budget|bill|goal):[A-Za-z0-9_-]{1,128}$/.test(key));
}

function validateId(id, label) {
  if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(id)) {
    throw new TypeError(`${label} must be a stable 1–128 character ID (letters, digits, _ or -)`);
  }
}

function posting(accountKey, deltaCents) {
  if (!isAccountKey(accountKey)) throw new RangeError(`Unrecognized account key: ${accountKey}`);
  assertCents(deltaCents, 'deltaCents', { allowNegative: true });
  return { accountKey, deltaCents };
}

export function createEvent({ eventId, requestId, eventType, amountCents, effectiveDate, postings }) {
  validateId(eventId, 'eventId');
  validateId(requestId, 'requestId');
  if (!VALID_EVENT_TYPES.has(eventType)) throw new RangeError(`Unknown eventType: ${eventType}`);
  assertCents(amountCents, 'amountCents', { allowZero: eventType === 'opening_balance' });
  if (typeof effectiveDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(effectiveDate) ||
      Number.isNaN(Date.parse(`${effectiveDate}T00:00:00Z`)) ||
      new Date(`${effectiveDate}T00:00:00Z`).toISOString().slice(0, 10) !== effectiveDate) {
    throw new TypeError('effectiveDate must be a real YYYY-MM-DD calendar date');
  }
  if (!Array.isArray(postings) || postings.length < 2) throw new TypeError('At least two postings required');
  const checked = postings.map(({ accountKey, deltaCents }) => posting(accountKey, deltaCents));
  if (safeCentsSum(checked.map(p => p.deltaCents)) !== 0) {
    throw new RangeError('Journal postings must sum to zero');
  }
  return { eventId, requestId, eventType, amountCents, effectiveDate, postings: checked };
}

function event(meta, eventType, amountCents, entries) {
  return createEvent({ ...meta, eventType, amountCents, postings: entries });
}

export function openingBalance(meta, amountCents) {
  return event(meta, 'opening_balance', amountCents, [
    posting(EXTERNAL, -amountCents), posting(UNALLOCATED, amountCents),
  ]);
}

export function recordIncome(meta, amountCents) {
  return event(meta, 'income', amountCents, [
    posting(EXTERNAL, -amountCents), posting(UNALLOCATED, amountCents),
  ]);
}

export function allocate(meta, amountCents, destinationKey) {
  if (!isAccountKey(destinationKey) || [EXTERNAL, UNALLOCATED].includes(destinationKey)) {
    throw new RangeError('Allocation destination must be a budget, bill, or goal reserve');
  }
  return event(meta, 'allocate', amountCents, [
    posting(UNALLOCATED, -amountCents), posting(destinationKey, amountCents),
  ]);
}

export function release(meta, amountCents, sourceKey) {
  if (!isAccountKey(sourceKey) || [EXTERNAL, UNALLOCATED].includes(sourceKey)) {
    throw new RangeError('Release source must be a reserve');
  }
  return event(meta, 'release', amountCents, [
    posting(sourceKey, -amountCents), posting(UNALLOCATED, amountCents),
  ]);
}

export function transfer(meta, amountCents, sourceKey, destinationKey) {
  if (!isAccountKey(sourceKey) || !isAccountKey(destinationKey) ||
      sourceKey === EXTERNAL || destinationKey === EXTERNAL || sourceKey === destinationKey) {
    throw new RangeError('Transfer requires different internal account keys');
  }
  return event(meta, 'transfer', amountCents, [
    posting(sourceKey, -amountCents), posting(destinationKey, amountCents),
  ]);
}

// Budget spending draws from reserve then uses unallocated to cover overage.
// Goal/bill expenses require sufficient reserve; no implicit reserve debt.
export function recordExpense(meta, amountCents, sourceKey, availableSourceCents = 0) {
  assertCents(amountCents, 'amountCents', { allowZero: false });
  if (!isAccountKey(sourceKey) || sourceKey === EXTERNAL) throw new RangeError('Invalid expense source');
  if (sourceKey === UNALLOCATED) {
    return event(meta, 'expense', amountCents, [posting(UNALLOCATED, -amountCents), posting(EXTERNAL, amountCents)]);
  }
  assertCents(availableSourceCents, 'availableSourceCents');
  if (sourceKey.startsWith('budget:')) {
    const covered = Math.min(availableSourceCents, amountCents);
    const deficit = amountCents - covered;
    return event(meta, 'expense', amountCents, [
      posting(sourceKey, -covered),
      ...(deficit ? [posting(UNALLOCATED, -deficit)] : []),
      posting(EXTERNAL, amountCents),
    ]);
  }
  if (availableSourceCents < amountCents) throw new RangeError('Insufficient goal or bill reserve');
  return event(meta, 'expense', amountCents, [posting(sourceKey, -amountCents), posting(EXTERNAL, amountCents)]);
}

export function emptyLedger() {
  return { accounts: { [UNALLOCATED]: 0 }, receipts: {} };
}

export function accountBalance(state, key) {
  return state.accounts[key] ?? 0;
}

// Apply immutable events, check request-id reuse and source balances.
// `receipts` is an in-memory test model; persistent idempotency must be
// implemented atomically in Firestore operations/{requestId}.
export function applyEvent(state, journalEvent) {
  if (!state || typeof state !== 'object' || !state.accounts || !state.receipts) {
    throw new TypeError('Invalid ledger state');
  }
  const validated = createEvent(journalEvent);
  const fingerprint = JSON.stringify(validated);
  if (Object.hasOwn(state.receipts, validated.requestId)) {
    if (state.receipts[validated.requestId] === fingerprint) return state;
    throw new RangeError('Request ID collision with different payload');
  }
  const next = { ...state.accounts };
  for (const { accountKey, deltaCents } of validated.postings) {
    if (accountKey === EXTERNAL) continue;
    next[accountKey] = safeCentsSum([next[accountKey] ?? 0, deltaCents]);
  }
  // Only unallocated may be negative (e.g. an actual expense beyond available funds).
  for (const [key, value] of Object.entries(next)) {
    if (key !== UNALLOCATED && value < 0) throw new RangeError(`Insufficient reserve: ${key}`);
  }
  // Explicit transfers/allocations can't overdraft unallocated, even though
  // legitimate expenses can create a visible deficit.
  if (validated.eventType === 'allocate' || validated.eventType === 'transfer') {
    if (next[UNALLOCATED] < 0) throw new RangeError('Insufficient unallocated funds');
  }
  return { accounts: next, receipts: { ...state.receipts, [validated.requestId]: fingerprint } };
}

export function trackedTotalCents(state) {
  return safeCentsSum(Object.values(state.accounts));
}

export function ledgerSummary(state) {
  const reserves = { budget: 0, bill: 0, goal: 0 };
  for (const [key, cents] of Object.entries(state.accounts)) {
    const prefix = key.split(':', 1)[0];
    if (Object.hasOwn(reserves, prefix)) reserves[prefix] = safeCentsSum([reserves[prefix], cents]);
  }
  const unallocatedCents = accountBalance(state, UNALLOCATED);
  const trackedTotal = trackedTotalCents(state);
  if (trackedTotal !== safeCentsSum([unallocatedCents, ...Object.values(reserves)])) {
    throw new Error('Account invariant violated');
  }
  return { trackedTotalCents: trackedTotal, unallocatedCents, budgetReserveCents: reserves.budget,
    billReserveCents: reserves.bill, savingsReserveCents: reserves.goal };
}

// For local, pure calculations: derive available reserve from the actual state,
// never from the UI. The Firestore adapter must do the equivalent within its
// transaction after reading the authoritative journal/materialized state.
export function expenseFromState(state, meta, amountCents, sourceKey) {
  return recordExpense(meta, amountCents, sourceKey, accountBalance(state, sourceKey));
}

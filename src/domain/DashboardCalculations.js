function cents(value) {
  return Number.isSafeInteger(value) ? value : 0;
}

function getMonthRange(date = new Date()) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const currentDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const monthStart = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const nextMonth = new Date(year, month + 1, 1);
  const monthEnd = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}-01`;

  return { currentDate, monthStart, monthEnd };
}

function sumByType(transactions, type) {
  return transactions.reduce(
    // A corrected transaction stays in history as 'reversed' next to its
    // replacement, so counting it would double-charge (TEST-017).
    (total, transaction) => transaction?.eventType === type && transaction.status !== 'reversed'
      ? total + cents(transaction.amountCents)
      : total,
    0
  );
}

// Balances come from the backend-maintained ledger summary (summaries/current),
// so trackedTotal = unallocated + reserves holds by construction (INV-001).
export function calculateBalanceSummary(summary = {}) {
  const budgetReserveCents = cents(summary?.budgetReserveCents);
  const billReserveCents = cents(summary?.billReserveCents);
  const savingsReserveCents = cents(summary?.savingsReserveCents);

  return {
    trackedTotalCents: cents(summary?.trackedTotalCents),
    unallocatedCents: cents(summary?.unallocatedCents),
    budgetReserveCents,
    billReserveCents,
    savingsReserveCents,
    reservedCents: budgetReserveCents + billReserveCents + savingsReserveCents,
  };
}

export function calculateDashboardMetrics({ summary = {}, transactions = [], periods = [] } = {}, date = new Date()) {
  const { currentDate, monthStart, monthEnd } = getMonthRange(date);
  const safeTransactions = Array.isArray(transactions) ? transactions : [];
  const safePeriods = Array.isArray(periods) ? periods : [];
  const currentMonthTransactions = safeTransactions.filter((transaction) => (
    typeof transaction?.effectiveDate === 'string' &&
    transaction.effectiveDate >= monthStart &&
    transaction.effectiveDate < monthEnd
  ));
  const currentPeriods = safePeriods.filter((period) => (
    period?.status === 'open' &&
    typeof period?.startDate === 'string' &&
    period.startDate <= currentDate &&
    typeof period?.endExclusiveDate === 'string' &&
    period.endExclusiveDate > monthStart
  ));

  return {
    availableBalanceCents: calculateBalanceSummary(summary).unallocatedCents,
    budgetSpentCents: currentPeriods.reduce((total, period) => total + cents(period.spentCents), 0),
    budgetLimitCents: currentPeriods.reduce((total, period) => total + cents(period.limitCents), 0),
    incomeCents: sumByType(currentMonthTransactions, 'income'),
    expensesCents: sumByType(currentMonthTransactions, 'expense'),
  };
}


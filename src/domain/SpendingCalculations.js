const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function validDate(value) {
  if (typeof value !== 'string' || !DAY_PATTERN.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function centsOf(transaction) {
  return Number.isSafeInteger(transaction?.amountCents)
    ? transaction.amountCents
    : Number.isSafeInteger(transaction?.amount)
      ? transaction.amount
      : 0;
}

export function isActualExpense(transaction) {
  return (transaction?.eventType ?? transaction?.type) === 'expense' && transaction?.status !== 'reversed' && centsOf(transaction) > 0;
}

export function isActualIncome(transaction) {
  return (transaction?.eventType ?? transaction?.type) === 'income' && transaction?.status !== 'reversed' && centsOf(transaction) > 0;
}

export function monthKey(date) {
  return validDate(date) ? date.slice(0, 7) : null;
}

export function formatMonthKey(key, locale = 'en-US') {
  if (typeof key !== 'string' || !/^\d{4}-\d{2}$/.test(key)) return '';
  return new Intl.DateTimeFormat(locale, { month: 'short' }).format(new Date(`${key}-01T00:00:00Z`));
}

function aggregateByMonth(transactions, predicate, { months = 6, endDate } = {}) {
  const expenses = (Array.isArray(transactions) ? transactions : [])
    .filter(predicate)
    .map((transaction) => ({
      ...transaction,
      amountCents: centsOf(transaction),
      effectiveDate: transaction.effectiveDate ?? transaction.date,
    }))
    .filter((transaction) => validDate(transaction.effectiveDate));

  const finalDate = validDate(endDate)
    ? new Date(`${endDate}T00:00:00Z`)
    : expenses.length
      ? new Date(`${expenses.map((item) => item.effectiveDate).sort().at(-1)}T00:00:00Z`)
      : new Date();
  finalDate.setUTCDate(1);

  const count = Math.max(1, Math.min(12, Number.isInteger(months) ? months : 6));
  const buckets = Array.from({ length: count }, (_, index) => {
    const date = new Date(Date.UTC(finalDate.getUTCFullYear(), finalDate.getUTCMonth() - count + index + 1, 1));
    const key = date.toISOString().slice(0, 7);
    return { key, label: formatMonthKey(key), amountCents: 0 };
  });
  const byKey = new Map(buckets.map((bucket) => [bucket.key, bucket]));
  expenses.forEach((transaction) => {
    const bucket = byKey.get(monthKey(transaction.effectiveDate));
    if (bucket) bucket.amountCents += transaction.amountCents;
  });
  return { buckets, expenses };
}

export function aggregateSpendingByMonth(transactions, options = {}) {
  return aggregateByMonth(transactions, isActualExpense, options);
}

export function aggregateIncomeByMonth(transactions, options = {}) {
  return aggregateByMonth(transactions, isActualIncome, options);
}

export function spendingSummary(transactions, { startDate, endDate } = {}) {
  const expenses = (Array.isArray(transactions) ? transactions : []).filter(isActualExpense);
  const inRange = expenses.filter((transaction) => {
    const date = transaction.effectiveDate ?? transaction.date;
    return validDate(date) && (!startDate || date >= startDate) && (!endDate || date <= endDate);
  });
  const totalCents = inRange.reduce((sum, transaction) => sum + centsOf(transaction), 0);
  const categoryTotals = inRange.reduce((totals, transaction) => {
    const category = transaction.categoryId ?? transaction.category ?? 'Other';
    totals[category] = (totals[category] ?? 0) + centsOf(transaction);
    return totals;
  }, {});
  return { totalCents, transactionCount: inRange.length, categoryTotals };
}

export function incomeSummary(transactions, { startDate, endDate } = {}) {
  const income = (Array.isArray(transactions) ? transactions : [])
    .filter(isActualIncome)
    .filter((transaction) => {
      const date = transaction.effectiveDate ?? transaction.date;
      return validDate(date) && (!startDate || date >= startDate) && (!endDate || date <= endDate);
    });
  return {
    totalCents: income.reduce((sum, transaction) => sum + centsOf(transaction), 0),
    transactionCount: income.length,
  };
}


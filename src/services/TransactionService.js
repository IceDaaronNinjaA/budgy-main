import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';

import app, { auth, db } from '../../config/firebase';

const functions = getFunctions(app, 'us-central1');

function requireUser() {
  if (!auth.currentUser) throw new Error('Sign in before managing transactions.');
  return auth.currentUser;
}

function makeId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
    .replace(/[^A-Za-z0-9_-]/g, '-')
    .slice(0, 110);
}

async function callFinancialFunction(name, payload) {
  const callable = httpsCallable(functions, name);
  const response = await callable(payload);
  return response.data;
}

export async function getTransactionFormData() {
  const user = requireUser();
  const [summarySnapshot, categorySnapshot, budgetSnapshot, periodSnapshot, goalSnapshot] = await Promise.all([
    getDoc(doc(db, 'users', user.uid, 'summaries', 'current')),
    getDocs(collection(db, 'users', user.uid, 'categories')),
    getDocs(collection(db, 'users', user.uid, 'budgetRules')),
    getDocs(collection(db, 'users', user.uid, 'budgetPeriods')),
    getDocs(collection(db, 'users', user.uid, 'savingsGoals')),
  ]);

  const categories = categorySnapshot.docs
    .map((item) => ({ id: item.id, ...item.data() }))
    .filter((item) => item.archived !== true)
    .sort((a, b) => a.name.localeCompare(b.name));
  const summary = summarySnapshot.exists() ? summarySnapshot.data() : null;
  const accounts = summary?.accounts ?? (summary ? { unallocated: summary.unallocatedCents ?? 0 } : {});
  const budgetRules = new Map(budgetSnapshot.docs.map((item) => [item.id, { id: item.id, ...item.data() }]));
  const goals = new Map(goalSnapshot.docs
    .filter((item) => item.data().archived !== true)
    .map((item) => [item.id, { id: item.id, ...item.data() }]));
  const periods = periodSnapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
  const sources = [];

  if (summary) {
    sources.push({
      key: 'unallocated',
      label: 'Unallocated funds',
      balanceCents: accounts.unallocated ?? summary.unallocatedCents ?? 0,
      kind: 'unallocated',
    });

    for (const [key, balanceCents] of Object.entries(accounts)) {
      if (key.startsWith('budget:')) {
        const budgetId = key.slice('budget:'.length);
        const budget = budgetRules.get(budgetId);
        const period = periods.find((item) => item.budgetId === budgetId && item.status === 'open');
        if (budget && period) {
          sources.push({
            key,
            label: budget.name,
            balanceCents,
            kind: 'budget',
            budgetPeriodId: period.periodId ?? period.id,
            startDate: period.startDate,
            endExclusiveDate: period.endExclusiveDate,
          });
        }
      } else if (key.startsWith('goal:')) {
        const goalId = key.slice('goal:'.length);
        const goal = goals.get(goalId);
        if (goal && balanceCents > 0) {
          sources.push({ key, label: goal.name, balanceCents, kind: 'goal' });
        }
      }
      // Managed bill reserves are intentionally omitted. They must be spent
      // through the bill-payment workflow so the occurrence is marked paid once.
    }
  }

  return { accountInitialized: Boolean(summary), categories, sources };
}

export async function addTransaction(transaction) {
  requireUser();
  const requestId = transaction.requestId ?? makeId(transaction.type);
  const payload = {
    requestId,
    amountCents: transaction.amountCents,
    effectiveDate: transaction.effectiveDate,
    description: transaction.description.trim(),
    categoryId: transaction.categoryId ?? null,
  };

  if (transaction.type === 'income') {
    return callFinancialFunction('recordIncome', payload);
  }

  if (transaction.type !== 'expense') throw new Error('Choose income or expense.');
  if (!transaction.sourceKey) throw new Error('Choose where this expense will come from.');
  payload.sourceKey = transaction.sourceKey;
  if (transaction.budgetPeriodId) payload.budgetPeriodId = transaction.budgetPeriodId;
  return callFinancialFunction('recordExpense', payload);
}

export async function createTransactionCategory({ name, type }) {
  requireUser();
  const categoryId = makeId('category');
  return callFinancialFunction('createCategory', {
    requestId: makeId('category-create'),
    categoryId,
    name: name.trim(),
    type,
  });
}

export async function getTransactions(userId) {
  const user = requireUser();
  if (userId && userId !== user.uid) throw new Error('You can only view your own transactions.');
  const snapshot = await getDocs(collection(db, 'users', user.uid, 'transactions'));
  return snapshot.docs
    .map((item) => {
      const data = item.data();
      return {
        id: item.id,
        ...data,
        type: data.eventType,
        amount: Number.isSafeInteger(data.amountCents) ? data.amountCents / 100 : 0,
        date: data.effectiveDate,
      };
    })
    .sort((a, b) => (b.effectiveDate ?? '').localeCompare(a.effectiveDate ?? ''));
}

import {
  addDoc,
  collection,
  getDocs,
  query,
  serverTimestamp,
  where,
} from 'firebase/firestore';

import { auth, db } from '../../config/firebase';

function makeRequestId(type) {
  return `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function addTransaction(transaction) {
  if (!auth.currentUser?.uid) {
    throw new Error('You must be signed in to add a transaction.');
  }

  if (!Number.isInteger(transaction.amount) || transaction.amount <= 0) {
    throw new Error('Transaction amount must be a positive integer number of cents.');
  }

  if (!transaction.description?.trim()) {
    throw new Error('Enter a name for this transaction.');
  }

  const userId = auth.currentUser.uid;
  const document = {
    userId,
    requestId: makeRequestId(transaction.type),
    eventType: transaction.type,
    amountCents: transaction.amount,
    effectiveDate: transaction.date,
    sourceKey: transaction.type === 'expense' ? 'unallocated' : null,
    categoryId: transaction.categoryId ?? null,
    description: transaction.description.trim(),
    schemaVersion: 1,
    status: 'active',
    createdAt: serverTimestamp(),
  };
  const result = await addDoc(collection(db, 'transactions'), document);

  return {
    id: result.id,
    ...document,
  };
}

export async function getTransactions(userId) {
  const authenticatedUserId = auth.currentUser?.uid;
  if (!authenticatedUserId || !userId || authenticatedUserId !== userId) {
    return [];
  }

  const transactionsRef = collection(db, 'transactions');
  const transactionQuery = query(transactionsRef, where('userId', '==', authenticatedUserId));
  const snapshot = await getDocs(transactionQuery);

  return snapshot.docs
    .map((document) => {
      const data = document.data();
      return {
        id: document.id,
        ...data,
        amount: data.amountCents,
        date: data.effectiveDate,
        type: data.eventType ?? data.type,
      };
    })
    .sort((first, second) => second.date.localeCompare(first.date));
}

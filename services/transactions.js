import {
  addDoc,
  collection,
  getDocs,
  query,
  serverTimestamp,
  where,
} from 'firebase/firestore';

import { db } from '../config/firebase';

const transactionsRef = collection(db, 'transactions');

export async function addTransaction(transaction) {
  const document = {
    ...(transaction.userId ? { userId: transaction.userId } : {}),
    type: transaction.type,
    amount: transaction.amount,
    category: transaction.category,
    description: transaction.description,
    date: transaction.date,
    createdAt: serverTimestamp(),
  };

  const result = await addDoc(transactionsRef, document);

  return {
    id: result.id,
    ...document,
  };
}

export async function getTransactions(userId) {
  const transactionQuery = userId
    ? query(transactionsRef, where('userId', '==', userId))
    : query(transactionsRef);
  const snapshot = await getDocs(transactionQuery);

  return snapshot.docs
    .map((document) => ({ id: document.id, ...document.data() }))
    .sort((first, second) => second.date.localeCompare(first.date));
}

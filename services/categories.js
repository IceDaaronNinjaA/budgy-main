import {
  addDoc,
  collection,
  getDocs,
  query,
  serverTimestamp,
  where,
} from 'firebase/firestore';

import { db } from '../config/firebase';

const categoriesCollection = collection(db, 'categories');

export async function addCategory(userId, category) {
  const document = {
    userId,
    name: category.name,
    type: category.type ?? 'expense',
    createdAt: serverTimestamp(),
  };

  const result = await addDoc(categoriesCollection, document);

  return {
    id: result.id,
    ...document,
  };
}

export async function getUserCategories(userId) {
  const categoriesQuery = query(
    categoriesCollection,
    where('userId', '==', userId)
  );
  const snapshot = await getDocs(categoriesQuery);

  return snapshot.docs
    .map((document) => ({ id: document.id, ...document.data() }))
    .sort((first, second) => first.name.localeCompare(second.name));
}

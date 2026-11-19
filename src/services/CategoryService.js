import {
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
} from 'firebase/firestore';

import { auth, db } from '../../config/firebase';

function categoriesCollection(userId) {
  return collection(db, 'categories');
}

function makeId(value, suffix) {
  const readable = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'category';
  return `${readable}-${Date.now()}-${suffix}`;
}

const DEFAULT_CATEGORIES = [
  { slug: 'food', name: 'Food', type: 'expense' },
  { slug: 'transportation', name: 'Transportation', type: 'expense' },
  { slug: 'shopping', name: 'Shopping', type: 'expense' },
  { slug: 'bills', name: 'Bills', type: 'expense' },
  { slug: 'salary', name: 'Salary', type: 'income' },
];

export async function ensureDefaultCategories(userId) {
  const authenticatedUserId = auth.currentUser?.uid;
  if (!authenticatedUserId || !userId || authenticatedUserId !== userId) {
    return [];
  }

  const existingCategories = await getUserCategories(userId);
  const existingKeys = new Set(existingCategories.map((category) => `${category.name}|${category.type}`));
  const missingCategories = DEFAULT_CATEGORIES.filter(
    (category) => !existingKeys.has(`${category.name}|${category.type}`)
  );

  if (missingCategories.length) {
    const batch = writeBatch(db);
    missingCategories.forEach((category) => {
      const categoryId = `default-${category.slug}-${authenticatedUserId}`;
      batch.set(doc(db, 'categories', categoryId), {
        userId: authenticatedUserId,
        categoryId,
        name: category.name,
        type: category.type,
        archived: false,
        schemaVersion: 1,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });
    await batch.commit();
  }

  return getUserCategories(userId);
}

export async function createUserCategory(category) {
  const authenticatedUserId = auth.currentUser?.uid;
  if (!authenticatedUserId) {
    throw new Error('You must be signed in to create a category.');
  }
  if (!category.name?.trim()) {
    throw new Error('Enter a category name.');
  }

  const categoryId = makeId(category.name, Math.random().toString(36).slice(2, 10));
  const categoryDocument = {
    userId: authenticatedUserId,
    categoryId,
    name: category.name.trim(),
    type: category.type,
    archived: false,
    schemaVersion: 1,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  await setDoc(doc(db, 'categories', categoryId), categoryDocument);

  return { id: categoryId, ...categoryDocument };
}

export async function addCategory(userId, category) {
  const authenticatedUserId = auth.currentUser?.uid;
  if (!authenticatedUserId || !userId || authenticatedUserId !== userId) {
    throw new Error('You must be signed in to manage categories.');
  }

  return createUserCategory(category);
}

export async function getUserCategories(userId) {
  const authenticatedUserId = auth.currentUser?.uid;
  if (!authenticatedUserId || !userId || authenticatedUserId !== userId) {
    return [];
  }

  const categoriesQuery = query(
    categoriesCollection(authenticatedUserId),
    where('userId', '==', authenticatedUserId)
  );
  const snapshot = await getDocs(categoriesQuery);

  return snapshot.docs
    .map((document) => ({ id: document.id, ...document.data() }))
    .filter((category) => category.archived !== true)
    .sort((first, second) => first.name.localeCompare(second.name));
}

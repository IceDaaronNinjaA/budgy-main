import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';

import { db } from '../config/firebase';

const goalsCollection = collection(db, 'goals');

export async function addGoal(userId, goal) {
  const document = {
    userId,
    name: goal.name,
    type: goal.type ?? 'savings',
    targetAmount: goal.targetAmount,
    currentAmount: goal.currentAmount ?? 0,
    deadline: goal.deadline ?? null,
    completed: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const result = await addDoc(goalsCollection, document);

  return {
    id: result.id,
    ...document,
  };
}

export async function getUserGoals(userId) {
  const goalsQuery = query(goalsCollection, where('userId', '==', userId));
  const snapshot = await getDocs(goalsQuery);

  return snapshot.docs
    .map((document) => ({ id: document.id, ...document.data() }))
    .sort((first, second) => {
      if (!first.deadline) return 1;
      if (!second.deadline) return -1;
      return first.deadline.localeCompare(second.deadline);
    });
}

export async function updateGoal(goalId, updates) {
  const goalReference = doc(db, 'goals', goalId);

  await setDoc(
    goalReference,
    {
      ...updates,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function deleteGoal(goalId) {
  await deleteDoc(doc(db, 'goals', goalId));
}

import { collection, doc, getDocs, runTransaction, serverTimestamp } from 'firebase/firestore';

import { auth, db } from '../../config/firebase';

function requireUser() {
  if (!auth.currentUser) throw new Error('You must be signed in to manage savings goals.');
  return auth.currentUser;
}

export async function getUserGoals() {
  const user = requireUser();
  const snapshot = await getDocs(collection(db, 'users', user.uid, 'savingsGoals'));
  return snapshot.docs.filter((item) => item.data().archived !== true).map((item) => {
    const goal = item.data();
    return { id: item.id, ...goal, savedCents: goal.currentReservedCents ?? 0 };
  }).sort((first, second) => first.deadlineDate.localeCompare(second.deadlineDate));
}

export async function createSavingsGoal(data) {
  const user = requireUser();
  const goalReference = doc(db, 'users', user.uid, 'savingsGoals', data.goalId);
  const goal = {
    goalId: data.goalId,
    name: data.name.trim(),
    ...(data.description?.trim() ? { description: data.description.trim() } : {}),
    targetCents: data.targetCents,
    startDate: data.startDate,
    deadlineDate: data.deadlineDate,
    initialReservedCents: 0,
    currentReservedCents: 0,
    lastOperationId: '',
    status: 'active',
    paused: false,
    archived: false,
    schemaVersion: 1,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  return runTransaction(db, async (transaction) => {
    const existing = await transaction.get(goalReference);
    if (existing.exists()) return { id: existing.id, ...existing.data(), duplicate: true };
    transaction.set(goalReference, goal);
    return { id: data.goalId, ...goal, savedCents: 0, duplicate: false };
  });
}

export async function updateSavingsGoal(data) {
  const user = requireUser();
  const goalReference = doc(db, 'users', user.uid, 'savingsGoals', data.goalId);
  return runTransaction(db, async (transaction) => {
    const existing = await transaction.get(goalReference);
    if (!existing.exists()) throw new Error('Savings goal not found.');
    const current = existing.data();
    const updated = {
      ...current,
      name: data.name.trim(),
      ...(data.description?.trim() ? { description: data.description.trim() } : {}),
      targetCents: data.targetCents,
      startDate: data.startDate,
      deadlineDate: data.deadlineDate,
      status: (current.currentReservedCents ?? 0) >= data.targetCents ? 'achieved' : 'active',
      updatedAt: serverTimestamp(),
    };
    transaction.update(goalReference, updated);
    return { id: existing.id, ...updated, savedCents: current.currentReservedCents ?? 0 };
  });
}

export async function archiveSavingsGoal(goalId) {
  const user = requireUser();
  const goalReference = doc(db, 'users', user.uid, 'savingsGoals', goalId);
  return runTransaction(db, async (transaction) => {
    const existing = await transaction.get(goalReference);
    if (!existing.exists()) throw new Error('Savings goal not found.');
    const current = existing.data();
    if ((current.currentReservedCents ?? 0) > 0) {
      throw new Error('Move all reserved funds before archiving this goal.');
    }
    transaction.update(goalReference, {
      archived: true,
      status: 'archived',
      updatedAt: serverTimestamp(),
    });
    return { id: existing.id, ...current, archived: true, status: 'archived' };
  });
}

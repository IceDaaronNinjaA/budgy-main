import { collection, doc, getDocs, runTransaction, serverTimestamp } from 'firebase/firestore';

import { auth, db } from '../../config/firebase';

function requireUser() {
  const user = auth.currentUser;
  if (!user) throw new Error('You must be signed in to manage savings goals.');
  return user;
}

function goalsCollection(uid) {
  return collection(db, 'users', uid, 'savingsGoals');
}

function mapGoal(document) {
  const goal = document.data();
  return { id: document.id, ...goal, savedCents: goal.currentReservedCents ?? goal.initialReservedCents ?? 0 };
}

export async function getUserGoals() {
  const user = requireUser();
  const snapshot = await getDocs(goalsCollection(user.uid));
  return snapshot.docs
    .map(mapGoal)
    .sort((first, second) => first.deadlineDate.localeCompare(second.deadlineDate));
}

export async function createSavingsGoal(data) {
  const user = requireUser();
  const goalReference = doc(db, 'users', user.uid, 'savingsGoals', data.goalId);
  const goalDocument = {
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
    if (existing.exists()) {
      const current = existing.data();
      const sameGoal = current.name === goalDocument.name
        && current.targetCents === goalDocument.targetCents
        && current.startDate === goalDocument.startDate
        && current.deadlineDate === goalDocument.deadlineDate;
      if (!sameGoal) throw new Error('A goal with this ID already exists.');
      return { id: existing.id, ...current, duplicate: true };
    }
    transaction.set(goalReference, goalDocument);
    return { id: data.goalId, ...goalDocument, savedCents: 0, duplicate: false };
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
      ...(data.description !== undefined ? { description: data.description.trim() } : {}),
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

export async function setSavingsGoalPaused(data) {
  const user = requireUser();
  const goalReference = doc(db, 'users', user.uid, 'savingsGoals', data.goalId);
  return runTransaction(db, async (transaction) => {
    const existing = await transaction.get(goalReference);
    if (!existing.exists()) throw new Error('Savings goal not found.');
    transaction.update(goalReference, { paused: data.paused, updatedAt: serverTimestamp() });
    return { id: existing.id, ...existing.data(), paused: data.paused };
  });
}

async function applyGoalOperation({ goalId, requestId, amountCents, kind }) {
  const user = requireUser();
  const goalReference = doc(db, 'users', user.uid, 'savingsGoals', goalId);
  const operationReference = doc(db, 'users', user.uid, 'goalOperations', requestId);

  return runTransaction(db, async (transaction) => {
    const [goalSnapshot, operationSnapshot] = await Promise.all([
      transaction.get(goalReference),
      transaction.get(operationReference),
    ]);
    if (operationSnapshot.exists()) return { ...operationSnapshot.data(), duplicate: true };
    if (!goalSnapshot.exists()) throw new Error('Savings goal not found.');
    const goal = goalSnapshot.data();
    if (goal.paused || goal.archived) throw new Error('Savings goal is not available.');
    const currentReservedCents = goal.currentReservedCents ?? 0;
    const resultingReservedCents = kind === 'contribute'
      ? currentReservedCents + amountCents
      : currentReservedCents - amountCents;
    if (resultingReservedCents < 0) throw new Error('Cannot withdraw more than the goal reserve.');
    const status = resultingReservedCents >= goal.targetCents
      ? 'achieved'
      : goal.status === 'overdue' ? 'overdue' : 'active';
    const operation = {
      operationId: requestId,
      goalId,
      kind,
      amountCents,
      resultingReservedCents,
      schemaVersion: 1,
      createdAt: serverTimestamp(),
    };
    transaction.update(goalReference, {
      currentReservedCents: resultingReservedCents,
      lastOperationId: requestId,
      status,
      updatedAt: serverTimestamp(),
    });
    transaction.create(operationReference, operation);
    return { ...operation, savedCents: resultingReservedCents, duplicate: false };
  });
}

export function contributeToSavingsGoal(data) {
  return applyGoalOperation({ ...data, kind: 'contribute' });
}

export function withdrawFromSavingsGoal(data) {
  return applyGoalOperation({ ...data, kind: 'withdraw' });
}

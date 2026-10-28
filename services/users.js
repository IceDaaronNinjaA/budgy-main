import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';

import { db } from '../config/firebase';

const usersCollection = 'users';

export async function saveUserProfile(userId, profile) {
  const userReference = doc(db, usersCollection, userId);

  await setDoc(
    userReference,
    {
      ...profile,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  return getUserProfile(userId);
}

export async function getUserProfile(userId) {
  const snapshot = await getDoc(doc(db, usersCollection, userId));

  if (!snapshot.exists()) {
    return null;
  }

  return {
    id: snapshot.id,
    ...snapshot.data(),
  };
}

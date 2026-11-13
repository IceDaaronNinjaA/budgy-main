import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';

import { auth, db } from '../../config/firebase';

const usersCollection = 'users';

// Resolves once Firebase Auth has restored the session; null when signed out.
// Services derive the UID from this, never from a screen-supplied userId.
export function getAuthenticatedUser() {
  if (auth.currentUser) return Promise.resolve(auth.currentUser);

  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      resolve(user);
    });
  });
}

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

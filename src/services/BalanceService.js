import { doc, getDoc } from 'firebase/firestore';

import { db } from '../../config/firebase';
import { calculateBalanceSummary } from '@/domain/DashboardCalculations';
import { getAuthenticatedUser } from './UserService';

// Reads the signed-in user's ledger summary; an account with no financial
// history yet resolves to all-zero balances (FR-DASH-006).
export async function getUserBalance() {
  const user = await getAuthenticatedUser();
  if (!user?.uid) {
    throw new Error('You must be signed in to load your balance.');
  }

  const snapshot = await getDoc(doc(db, 'users', user.uid, 'summaries', 'current'));
  return calculateBalanceSummary(snapshot.exists() ? snapshot.data() : {});
}

import { collection, getDocs, getDoc, query, where, doc } from 'firebase/firestore';

import { db } from '../../config/firebase';
import { calculateDashboardMetrics } from '@/domain/DashboardCalculations';
import { getAuthenticatedUser } from './UserService';

function labelRead(source, request) {
  return request.catch((error) => {
    const labeledError = new Error(`Dashboard ${source} read failed: ${error.message}`);
    labeledError.code = error.code;
    labeledError.cause = error;
    throw labeledError;
  });
}

export async function getDashboardMetrics(date = new Date()) {
  const user = await getAuthenticatedUser();
  const uid = user?.uid;
  if (!uid) {
    throw new Error('You must be signed in to load dashboard data.');
  }

  const year = date.getFullYear();
  const month = date.getMonth();
  const currentDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const monthStart = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const nextMonth = new Date(year, month + 1, 1);
  const monthEnd = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}-01`;
  const userPath = ['users', uid];
  const summaryRef = doc(db, ...userPath, 'summaries', 'current');
  const transactionsRef = collection(db, ...userPath, 'transactions');
  const periodsRef = collection(db, ...userPath, 'budgetPeriods');

  const [summarySnapshot, transactionsSnapshot, periodsSnapshot] = await Promise.all([
    labelRead('summary', getDoc(summaryRef)),
    labelRead('transactions', getDocs(query(
      transactionsRef,
      where('effectiveDate', '>=', monthStart),
      where('effectiveDate', '<', monthEnd),
    ))),
    labelRead('budgetPeriods', getDocs(query(periodsRef, where('startDate', '<=', currentDate)))),
  ]);

  const summary = summarySnapshot.exists() ? summarySnapshot.data() : {};
  return calculateDashboardMetrics({
    summary,
    transactions: transactionsSnapshot.docs.map((snapshot) => snapshot.data()),
    periods: periodsSnapshot.docs.map((snapshot) => snapshot.data()),
  }, date);
}


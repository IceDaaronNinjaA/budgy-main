import { getAccountSummary } from './TransactionService';

export async function getUserBalance(userId) {
  const summary = await getAccountSummary(userId);
  return summary?.trackedTotalCents ?? 0;
}

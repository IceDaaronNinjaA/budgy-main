import { getTransactions } from './transactions';

export async function getUserBalance(userId) {
  const transactions = await getTransactions(userId);

  return transactions.reduce(
    (balance, transaction) => {
      const amount = Number(transaction.amount) || 0;

      return transaction.type === 'income'
        ? balance + amount
        : balance - amount;
    },
    0
  );
}

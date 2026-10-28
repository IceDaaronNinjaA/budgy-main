import { initializeApp } from 'firebase/app';
import {
  doc, getFirestore, serverTimestamp, writeBatch,
} from 'firebase/firestore';
import { firebaseConfig } from '../config/firebase-config.js';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const batch = writeBatch(db);
const userId = '7f3d8b4e-6a21-4c9d-91f7-2e5a8b0c4d63';

batch.set(doc(db, 'users', userId), {
  displayName: 'Budget User',
  currency: 'USD',
  updatedAt: serverTimestamp(),
});

const categories = [
  { id: 'salary', name: 'Salary', type: 'income' },
  { id: 'food', name: 'Food', type: 'expense' },
  { id: 'transportation', name: 'Transportation', type: 'expense' },
];

for (const category of categories) {
  batch.set(doc(db, 'categories', category.id), {
    userId,
    name: category.name,
    type: category.type,
    updatedAt: serverTimestamp(),
  });
}

const transactions = [
  {
    id: 'sample-salary',
    type: 'income',
    amount: 2500,
    category: 'Salary',
    description: 'Monthly salary',
    date: '2026-10-01T09:00:00.000Z',
  },
  {
    id: 'sample-groceries',
    type: 'expense',
    amount: 86.4,
    category: 'Food',
    description: 'Weekly groceries',
    date: '2026-10-05T17:30:00.000Z',
  },
  {
    id: 'sample-transportation',
    type: 'expense',
    amount: 42,
    category: 'Transportation',
    description: 'Gas',
    date: '2026-10-08T18:00:00.000Z',
  },
];

for (const transaction of transactions) {
  batch.set(doc(db, 'transactions', transaction.id), {
    userId,
    type: transaction.type,
    amount: transaction.amount,
    category: transaction.category,
    description: transaction.description,
    date: transaction.date,
    updatedAt: serverTimestamp(),
  });
}

const goals = [
  {
    id: 'emergency-fund',
    name: 'Emergency fund',
    type: 'savings',
    targetAmount: 1000,
    currentAmount: 250,
    deadline: '2027-03-01',
  },
  {
    id: 'monthly-food-limit',
    name: 'Monthly food limit',
    type: 'spending_limit',
    targetAmount: 400,
    currentAmount: 86.4,
    deadline: '2026-10-31',
  },
];

for (const goal of goals) {
  batch.set(doc(db, 'goals', goal.id), {
    userId,
    name: goal.name,
    type: goal.type,
    targetAmount: goal.targetAmount,
    currentAmount: goal.currentAmount,
    deadline: goal.deadline,
    completed: false,
    updatedAt: serverTimestamp(),
  });
}

await batch.commit();

console.log('Seed completed successfully.');
console.log('Seed user:', userId);
console.log('Created or updated: 1 user, 3 categories, 3 transactions, 2 goals.');

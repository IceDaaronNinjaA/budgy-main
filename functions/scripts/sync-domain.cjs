'use strict';
const fs = require('node:fs');
const path = require('node:path');
const source = path.resolve(__dirname, '../../src/domain');
const target = path.resolve(__dirname, '../shared');
fs.mkdirSync(target, { recursive: true });
for (const name of ['MoneyCalculations.js', 'LedgerCalculations.js', 'SavingsCalculations.js', 'BudgetCalculations.js']) {
  fs.copyFileSync(path.join(source, name), path.join(target, name));
}
fs.writeFileSync(path.join(target, 'package.json'), '{"type":"module"}\n');
console.log('Financial domain synchronized into functions/shared');

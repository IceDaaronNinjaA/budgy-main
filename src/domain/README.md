# Domain — Financial Business Logic

This directory contains Budgys core financial calculations and business rules.

## Responsibilities

- Balance and unallocated-funds calculations
- Budget allocation and overspending calculations
- Savings goal progress and required savings pace
- Recurring budget periods and funding calculations
- Financial consistency and accounting rules

## Planned Modules

- BalanceCalculations.js
- BudgetCalculations.js
- SavingsCalculations.js
- AllocationCalculations.js
- RecurrenceCalculations.js

## Development Guidelines

- Store and calculate monetary values using integer cents.
- Follow BUDGY_REQUIREMENTS.md as the authoritative specification.
- Keep domain calculations independent of React components and Firebase.
- Prefer pure functions that can be tested independently.
- Create modules only when their functionality is implemented.

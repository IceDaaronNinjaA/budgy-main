# Tests — Automated Verification

This directory contains automated tests for Budgys financial logic,
data services, and application behavior.

## Testing Priorities

1. Financial balance consistency
2. Income and expense calculations
3. Budget allocation and overspending
4. Savings goal calculations and deadlines
5. Recurring budget funding and period resets
6. Data validation and error handling
7. Firebase service behavior

## Planned Test Files

- BalanceCalculations.test.js
- BudgetCalculations.test.js
- SavingsCalculations.test.js
- AllocationCalculations.test.js
- TransactionService.test.js

## Development Guidelines

- Follow the acceptance criteria in BUDGY_REQUIREMENTS.md.
- Test monetary calculations using integer cents.
- Include edge cases and invalid inputs.
- Keep unit tests independent of production Firebase.
- Add tests alongside the functionality being implemented.

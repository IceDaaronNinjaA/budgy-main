# Validation — Input and Data Validation

This directory contains reusable validation functions for Budgys financial data.

## Responsibilities

- Validate transaction amounts and transaction types
- Validate budget periods, spending limits, and allocations
- Validate savings targets, deadlines, and contributions
- Reject malformed or unsupported financial inputs
- Enforce data constraints defined in BUDGY_REQUIREMENTS.md

## Planned Modules

- TransactionValidation.js
- BudgetValidation.js
- SavingsGoalValidation.js

## Development Guidelines

- Centralize validation rather than duplicating rules across screens.
- Return clear validation errors for invalid inputs.
- Validate monetary values before writing them to Firestore.
- Client-side validation does not replace Firestore security rules.
- Create modules only when their functionality is implemented.

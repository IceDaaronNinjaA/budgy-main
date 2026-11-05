# Budgy — Product Requirements & Technical Specification

**Document ID:** BUDGY-SRS  
**Version:** 1.0 — proposed team baseline  
**Prepared:** November 5, 2026  
**Status:** Working specification for team review; not yet merged into GitHub  
**Repository:** https://github.com/IceDaaronNinjaA/budgy-main  
**Intended readers:** Team members, reviewers, future contributors, and coding agents

> **Source-of-truth rule:** This document specifies the *intended behavior*. It is not a statement that all features are implemented. Where current code differs, treat it as an implementation gap, not permission to redefine the product. Before treating this as team policy, the team should review and adopt it. Do not silently change financial semantics or data contracts during implementation.

## Contents

1. [Purpose, evidence, and decision status](#1-purpose-evidence-and-decision-status)
2. [Product definition and objectives](#2-product-definition-and-objectives)
3. [MVP, later phases, and exclusions](#3-mvp-later-phases-and-exclusions)
4. [Terminology and financial invariants](#4-terminology-and-financial-invariants)
5. [Functional requirements: identity and setup](#5-functional-requirements-identity-and-setup)
6. [Functional requirements: financial ledger and allocations](#6-functional-requirements-financial-ledger-and-allocations)
7. [Functional requirements: budgets and recurring funding](#7-functional-requirements-budgets-and-recurring-funding)
8. [Functional requirements: savings goals](#8-functional-requirements-savings-goals)
9. [Functional requirements: recurring bills](#9-functional-requirements-recurring-bills)
10. [Functional requirements: dashboard, history, and settings](#10-functional-requirements-dashboard-history-and-settings)
11. [Mathematical definitions and worked examples](#11-mathematical-definitions-and-worked-examples)
12. [Screen map and primary user journeys](#12-screen-map-and-primary-user-journeys)
13. [Application architecture and module responsibilities](#13-application-architecture-and-module-responsibilities)
14. [Firestore data model and field dictionary](#14-firestore-data-model-and-field-dictionary)
15. [Transaction integrity, automation, and lifecycle](#15-transaction-integrity-automation-and-lifecycle)
16. [Security, privacy, and nonfunctional requirements](#16-security-privacy-and-nonfunctional-requirements)
17. [Future Tamagotchi system and initial balancing](#17-future-tamagotchi-system-and-initial-balancing)
18. [Acceptance scenarios and tests](#18-acceptance-scenarios-and-tests)
19. [Current repository gap map](#19-current-repository-gap-map)
20. [Rules for developers and coding agents](#20-rules-for-developers-and-coding-agents)
21. [Decisions and controlled assumptions](#21-decisions-and-controlled-assumptions)

---

## 1. Purpose, evidence, and decision status

### 1.1 Purpose

Provide one unambiguous description of what Budgy does, its data structures, application screens, calculations, automation behavior, and expected implementation boundaries. A teammate should be able to explain any major workflow; an agent should be able to implement one without inventing conflicting financial behavior. This is **not** a project calendar, sprint plan, or task assignment document.

### 1.2 Evidence hierarchy

1. **Team-confirmed product decisions:** Statements gathered in the November 2026 scope discussion: manual financial entry; recurring category budgets; deadline-based savings goals; daily/weekly progress; no bank integration; Tamagotchi after financial functionality.
2. **Subsequent accepted design decisions:** One tracked pool of funds; envelope-style allocations; automatic recurring funding; overspending displayed as a negative variance and covered from unallocated funds; unused budget money reset-and-released; sensible defaults for edge cases and pet balancing.
3. **Supporting references:** Team README, whiteboard, Figma screenshots, Trello screenshots, and repository inspection.
4. **Implementation observations:** Current code is useful evidence of progress, **not** an overriding specification.

### 1.3 Decision labels

- **CONFIRMED:** Established explicitly in team discussion.
- **ADOPTED DESIGN:** Agreed in subsequent requirements discussion; subject to team-wide ratification.
- **DEFAULT:** Concrete engineering interpretation needed for deterministic behavior. Team may amend through a documented change.
- **FUTURE:** Specified for a later release; not required to pass MVP acceptance.

Requirements prefixed `FR-`, `DATA-`, `NFR-`, `PET-`, or `TEST-` are normative for their stated phase. “Shall” means required. Money examples are illustrative unless marked otherwise.

---

## 2. Product definition and objectives

### 2.1 Product statement

**Budgy is a mobile-first, manually maintained personal finance application that records income and expenses, allocates existing funds to recurring spending budgets and time-bound savings goals, and visualizes spending and savings progress.** It does not access bank accounts or claim that self-reported balances equal a bank's records. After the financial MVP is complete, a virtual Tamagotchi pet will react to progress on budgets and savings goals.

### 2.2 Primary objectives

1. Make financial activity easy to enter accurately and understand at a glance.
2. Show **total tracked money**, **money reserved for particular purposes**, and **money still unallocated** separately.
3. Help users control spending through funded budgets, with visible overspending.
4. Help users plan savings by target and deadline, including daily pace calculations.
5. Preserve an understandable history of entries, allocations, funding decisions, and corrections.
6. Keep each user's records private.
7. Later, reward sustainable financial progress with a pet without distorting the accounting.

### 2.3 Intended user / usage assumptions

Individual users manually track a **single conceptual cash pool**; there is no bank sync, credit-account reconciliation, investment portfolio, or multi-currency conversion. Initial version targets Android/iOS with React Native/Expo. Web builds may be useful for development but are not a required production platform unless the team separately agrees.

### 2.4 Fundamental distinctions

| Concept | Meaning | What changes it |
|---|---|---|
| Total tracked balance | Self-reported money presently held | Opening balance, income, expense, correction |
| Unallocated balance | Tracked money not reserved in a budget, bill reserve, or savings goal | Income, direct spending, funding, releases, deficit coverage |
| Budget funding | Reserved money available for spending in a defined category/period | Funding, reallocation, budget spending, period close |
| Budget limit | Intended maximum spending during a period | User's budget rule; **not** automatically changed by extra funding |
| Budget variance | Spending limit minus actual spending; negative when overspent | Transactions, limit changes, period selection |
| Savings allocation | Money earmarked toward a goal, **not yet spent** | Contributions, withdrawals, goal-funded purchases |
| Recurring bill | Expected future payment | Scheduled occurrence and payment confirmation |
| Pet health / XP | Gamification metrics, never actual currency | Future daily evaluations and achievements |

---

## 3. MVP, later phases, and exclusions

### 3.1 Financial MVP — required

- **MVP-01** Account creation, login, logout, user-isolated records and Firebase security rules.
- **MVP-02** Single tracked account with initial balance; manual income and expense entry; edit/correct/delete history.
- **MVP-03** Named spending categories and user-created **funded** budgets with weekly/monthly periods.
- **MVP-04** Automatic budget spending accounting, negative limit variance, and unallocated-funds deficit coverage.
- **MVP-05** Automatic recurring funding of defined allocations, funding priorities, partial-funding status, and manual allocation adjustments.
- **MVP-06** End-of-period **reset and release**; historical budgets/expenses retained.
- **MVP-07** Deadline-based monetary savings goals, manual contributions/withdrawals, original and remaining daily savings pace, cumulative on-track status.
- **MVP-08** Recurring bill definitions with scheduled occurrences, reserves, and **payment confirmation**.
- **MVP-09** Dashboard displaying actual financial calculations; transactions, budgets, goals, and history/summary screens.
- **MVP-10** Reliable persistence, input validation, ownership enforcement, loading/error states, and acceptance tests.

### 3.2 Future / after financial MVP

- **FUTURE-01** Tamagotchi pet: daily health, XP, exponential levels, health capacity, recovery, evolution visuals.
- **FUTURE-02** Optional budget rollover preference (MVP always reset-and-release).
- **FUTURE-03** Pet customization, alternative species, accessories, advanced animations.
- **FUTURE-04** Optional reminders/notifications, advanced financial charts, additional budget recurrence patterns, automatic contribution rules.
- **FUTURE-05** Optional habit goals, if separately approved; **not** interchangeable with savings goals.

### 3.3 Explicitly out of scope for MVP

Bank API connections, linked-card account access, importing real bank transactions, payment initiation, investment accounts, loan amortization, multiple actual accounts, credit reconciliation, currency exchange, Face ID as a required login method, multiuser/shared household finances, tax reporting, financial advice or investment recommendations, and the virtual pet itself. Static Figma elements do not override these exclusions.

### 3.4 Minimum viable demonstration

A new user signs up, enters opening money, records income, funds a weekly or monthly budget, records a purchase assigned to that budget, sees total/unallocated/budget balances update correctly, creates a goal with a deadline, contributes money to the goal, observes an accurate daily savings pace, sees a scheduled bill reserve and confirms payment, restarts the app, and finds accurate persisted records. Pet functionality is **not** necessary to pass this demonstration.

---

## 4. Terminology and financial invariants

### 4.1 Money representation

**DATA-MONEY-001** All persisted monetary values shall be signed integers in the user's fixed currency minor unit (USD **cents** for MVP); e.g., `$12.34` becomes `1234`. Never persist floating-point dollar arithmetic as the financial source of truth. UI shall format cents to dollars. Reject NaN, infinity, fractional cents, and unsupported currency inputs.

**DATA-MONEY-002** Each financial event shall have a stable unique ID, `userId`, an effective local date, a server timestamp, and a transaction/correlation ID suitable for idempotency and audit.

### 4.2 Authoritative accounting identity

At any instant:

```text
TrackedTotalCents = UnallocatedCents
                  + Σ BudgetReserveCents
                  + Σ BillReserveCents
                  + Σ SavingsReserveCents
```

**INV-001** This equality shall hold after every committed operation. Any unresolved funding shortfall is shown as negative **unallocated** funds or as an explicitly marked funding shortfall; it must **never** be hidden by fabricating income.

**INV-002** Allocations and transfers between reserves do **not** alter `TrackedTotalCents`.

**INV-003** True income increases `TrackedTotalCents`; true expense decreases it exactly once.

**INV-004** Budget performance (limit variance) is **not the same** as the budget's remaining funded reserve. Budget variance may be negative while reserve remains zero.

**INV-005** Savings balances represent reserved funds; achieving a goal does not itself spend or remove those funds.

**INV-006** No scheduled process may create money. A recurring allocation can move only already tracked funds, and automatic funding does not count as income.

### 4.3 Single-source-of-truth strategy

The **financial event journal** is authoritative. Balances can be derived from event postings; optionally use materialized summaries for performance, updated atomically and reconciled to the journal. Never independently mutate separate displayed balances from different UI components.

Use an immutable journal entry with balanced postings for reserve transfers; use reversing/correcting entries to preserve auditability. If implementation uses ordinary transaction documents plus funding events instead of formal double-entry postings, it **must still enforce the same invariants and transactional atomicity**.

### 4.4 Financial date and period conventions

- Store instants as UTC timestamps and effective transaction dates as `YYYY-MM-DD` in the user's configured time zone (`America/Boise` is an example, **not** a universal default).
- Account settings determine the local time zone. Use local calendar boundaries for budgets/goals, not `24h * N` approximations around DST.
- Weekly periods start **Monday 00:00 local** and end immediately before the following Monday.
- Monthly periods start the **first day** and end immediately before the next month's first day.
- A savings deadline date is **inclusive** for contributing and evaluating progress.
- The app uses a consistent day boundary for all daily status calculations; changes to time zone require safe recomputation rules.

---

## 5. Functional requirements: identity and setup

| ID | Requirement | Status |
|---|---|---|
| FR-AUTH-001 | User shall register and authenticate with Firebase Auth email/password. | ADOPTED DESIGN / MVP |
| FR-AUTH-002 | Users shall log out; protected financial screens shall not expose prior user's cached data after logout. | ADOPTED DESIGN / MVP |
| FR-AUTH-003 | Every user-owned record shall be bound to the authenticated UID; clients may not impersonate another UID. | ADOPTED DESIGN / MVP |
| FR-AUTH-004 | New users shall initialize one tracked balance with an explicit opening amount (including `$0`), currency `USD`, and time zone. | DEFAULT / MVP |
| FR-AUTH-005 | The app shall identify and explain that amounts are manually recorded and may differ from bank balances. | DEFAULT / MVP |
| FR-AUTH-006 | Authentication and Firestore access failures shall display actionable errors without incorrectly indicating success. | DEFAULT / MVP |
| FR-AUTH-007 | Profile settings shall include at least display name, preferred time zone, and logout. | DEFAULT / MVP |

**Initial balance:** Record as one distinct `opening_balance` journal event, not as a fictitious paycheck. Changing it later requires an auditable balance adjustment, not erasing past income/expenses.

---

## 6. Functional requirements: financial ledger and allocations

### 6.1 Income, expenses, and corrections

| ID | Requirement | Status |
|---|---|---|
| FR-TXN-001 | User shall manually record `income` with positive amount, date, description/source, and optional category. | CONFIRMED / MVP |
| FR-TXN-002 | User shall manually record `expense` with positive amount, date, category, description, and funding source. | CONFIRMED / MVP |
| FR-TXN-003 | Expense funding source shall be a budget reserve, bill reserve, savings goal reserve, or unallocated funds. | ADOPTED DESIGN / MVP |
| FR-TXN-004 | An expense shall decrease total tracked money by **exactly** its amount, and also consume the selected source/reserve according to these rules. | ADOPTED DESIGN / MVP |
| FR-TXN-005 | Income shall increase total money and initially increase unallocated funds; outstanding auto-funding may subsequently redistribute some of those funds. | ADOPTED DESIGN / MVP |
| FR-TXN-006 | Transactions shall be viewable, searchable/filterable by date/type/category, and editable/correctable with audit history. | DEFAULT / MVP |
| FR-TXN-007 | User shall be able to reverse/delete mistaken transactions; undo shall reverse all associated accounting effects and update summaries. | DEFAULT / MVP |
| FR-TXN-008 | Historic effective dates shall correctly place transactions in the corresponding budget period and spending summary. | DEFAULT / MVP |
| FR-TXN-009 | A transaction shall be committed atomically with all required reserve/journal updates; partial success is prohibited. | DEFAULT / MVP |

### 6.2 Allocations and transfers

| ID | Requirement | Status |
|---|---|---|
| FR-ALOC-001 | User shall fund a budget, bill reserve, or savings goal from unallocated money. | ADOPTED DESIGN / MVP |
| FR-ALOC-002 | User shall be able to manually increase/decrease allocations and move money between reserves, with clear audit entries. | ADOPTED DESIGN / MVP |
| FR-ALOC-003 | An allocation shall not be recorded as income or expense and shall not affect spending totals. | ADOPTED DESIGN / MVP |
| FR-ALOC-004 | Manual transfers shall reject funding beyond nonnegative unallocated funds unless explicitly resolving a negative unallocated deficit; negative balances shall never be disguised. | DEFAULT / MVP |
| FR-ALOC-005 | App shall display total, allocated by destination, unallocated, and any funding shortfall. | ADOPTED DESIGN / MVP |
| FR-ALOC-006 | Transfers shall be atomic, idempotent on retry, and traceable to an initiating action. | DEFAULT / MVP |

### 6.3 Overspending: chosen hybrid behavior

**FR-OVER-001** When an expense exceeds a budget's *remaining funded reserve*, the budget's reserve is consumed down to **zero**, and any uncovered portion is taken from **unallocated funds**. The category's `limit − actual_spending` remains negative and visible. Do not store the same deficit as both a negative budget reserve **and** a reduction of unallocated funds.

**FR-OVER-002** Overspending is measured against the **spending limit**, not merely against current reserve funding. A $100 expense against a $75 limit is $25 over-budget even if extra funds were available elsewhere.

**FR-OVER-003** When unallocated funds are too small to cover the excess, preserve the real expense; unallocated balance may become negative and the UI shall show a **funding deficit**. Users may subsequently rebalance from other reserves or enter income. Prevent misleading displays such as “all funds allocated correctly.”

**FR-OVER-004** Overspending history shall remain visible after coverage and after the budget period closes. Moving funds to cover overspending does not retroactively make the spending limit unexceeded.

**FR-OVER-005** Repeated budget spending shall draw against its funded reserve first; when the reserve is zero, subsequent expenses from that budget are covered entirely by unallocated funds while spending totals/variance continue to increase.

### 6.4 Savings as earmarked money

A savings contribution is a transfer from unallocated funds into a savings reserve. When the user eventually buys the target item, a goal-funded expense consumes savings reserve and decreases total money. It is never counted as a **second** expense when allocating to a goal.

---

## 7. Functional requirements: budgets and recurring funding

### 7.1 Budget structure and behavior

| ID | Requirement | Status |
|---|---|---|
| FR-BUD-001 | User shall create multiple named spending budgets with unique IDs, positive spending limits, and selectable category. | CONFIRMED / MVP |
| FR-BUD-002 | MVP periods shall include `weekly` and `monthly`, with a period start/end derived from user time zone. | ADOPTED DESIGN / MVP |
| FR-BUD-003 | Budget rule defines a spending **limit**; funding events define actual reserved money. They are separate fields. | ADOPTED DESIGN / MVP |
| FR-BUD-004 | Expenses linked to a budget occurrence shall count toward that occurrence's spending even if covered partly by unallocated funds. | ADOPTED DESIGN / MVP |
| FR-BUD-005 | User shall see period limit, money reserved, amount spent, limit variance, and current funding deficit. | ADOPTED DESIGN / MVP |
| FR-BUD-006 | Budget rule may be paused, resumed, and edited; changes shall not silently rewrite completed periods. | DEFAULT / MVP |
| FR-BUD-007 | Existing transactions shall not be assigned retroactively to a newly created budget unless the user explicitly performs reassignment. | DEFAULT / MVP |
| FR-BUD-008 | Multiple budgets can coexist. Each expense has one primary budget funding source; category alone does not imply duplicate charging to multiple budgets. | DEFAULT / MVP |

**Note:** A budget's category can assist in suggesting a funding source, but actual membership is determined by `budgetPeriodId` on the expense/charge. No automatic double counting.

### 7.2 Period closure

**FR-BUD-009 — RESET AND RELEASE:** On period end, any **positive** remaining reserved funds return to unallocated funds. The completed period is preserved read-only for history, with limit, spend, variance, start/end, and release record.

**FR-BUD-010:** Unspent funds do not roll over in MVP. Rollover is a future preference. Close old period **before** funding the new period; prevent duplicate releases/funding.

**FR-BUD-011:** Negative limit variance is a historical outcome, not a negative reserve to carry forward. The next period starts with zero reserve and its configured limit.

**FR-BUD-012:** Period closure must be robust to a device being offline. On next trusted processing opportunity, catch up periods in chronological order exactly once.

### 7.3 Automatic recurring funding

| ID | Requirement | Status |
|---|---|---|
| FR-FUND-001 | User may enable a recurring target allocation for each recurring budget or bill reserve. | ADOPTED DESIGN / MVP |
| FR-FUND-002 | On creation of a new period, define the target funding amount; attempt to fund from currently available unallocated funds. | ADOPTED DESIGN / MVP |
| FR-FUND-003 | Each funding rule has a numeric **priority**; smaller numbers fund first, ties sorted deterministically by creation time then ID. | DEFAULT / MVP |
| FR-FUND-004 | If insufficient money exists, partially fund the next priority using available positive unallocated funds; show shortfall; later income can complete outstanding funding. | DEFAULT / MVP |
| FR-FUND-005 | Do not auto-fund the same target more than once. Use `target - net funded` to determine outstanding amount; never reapply the full target for each paycheck. | DEFAULT / MVP |
| FR-FUND-006 | Manual overfunding is allowed when unallocated funds suffice, but does not increase the spending *limit* unless the user explicitly edits the limit. | DEFAULT / MVP |
| FR-FUND-007 | When a budget rule is paused, disable future automatic funding; existing funds stay allocated until user moves them or the period closes. | DEFAULT / MVP |
| FR-FUND-008 | Each attempted scheduled funding shall have an occurrence ID; retrying the same trigger must not duplicate transfers. | DEFAULT / MVP |

**Auto-funding trigger design:** At minimum evaluate when a new budget period becomes due, when new income is recorded, and when the app resumes online; scheduled backend execution is optional if catch-up logic is reliable. A missing open session shall not silently lose a recurring period.

---

## 8. Functional requirements: savings goals

### 8.1 Goals are monetary targets — not habits

| ID | Requirement | Status |
|---|---|---|
| FR-GOAL-001 | Savings goal shall have a name, positive target amount, start date, inclusive target deadline, and owner. | CONFIRMED / MVP |
| FR-GOAL-002 | User shall create multiple goals with independent contribution histories and reserved balances. | ADOPTED DESIGN / MVP |
| FR-GOAL-003 | User shall manually contribute funds from unallocated balance into a goal and may withdraw/reallocate funds using audit events. | CONFIRMED + ADOPTED DESIGN / MVP |
| FR-GOAL-004 | App shall show target, current allocated savings, remaining amount, deadline, original daily pace, updated required daily pace, and cumulative on-track status. | CONFIRMED + ADOPTED DESIGN / MVP |
| FR-GOAL-005 | Reaching the monetary target marks the savings objective `achieved`; its reserved money **stays reserved** until purchase, withdrawal, or release. | DEFAULT / MVP |
| FR-GOAL-006 | Spending from goal reserve shall lower tracked total and goal reserve, with an explicit goal-funded expense. This shall not count the savings contribution as an earlier expense. | ADOPTED DESIGN / MVP |
| FR-GOAL-007 | Goal may be edited/archived, with a history of changes; deleting with funds must require moving those funds to another destination. | DEFAULT / MVP |
| FR-GOAL-008 | Contributions are evaluated against the **cumulative expected savings**, not a demand for a new transfer every calendar day. | ADOPTED DESIGN / MVP |
| FR-GOAL-009 | Deadline passing does not delete a goal or its money. Goal becomes `overdue` if unachieved; user may contribute, revise deadline, or archive it. | DEFAULT / MVP |
| FR-GOAL-010 | A goal achieved before its deadline remains achieved even if no further daily contributions occur, unless contributions are withdrawn. | DEFAULT / MVP |

### 8.2 Savings pace formulas

Let `T` = target cents, `S` = starting reserved cents at goal creation, `C(d)` = total current goal reserve (including starting funds and subsequent net contributions) as of local date `d`; `d0` = start date; `D` = inclusive deadline; `N` = number of calendar dates from `d0` through `D` inclusive. Assume `D >= d0`. For `d` in the goal window let `k(d)` = completed/elapsed counted calendar dates from start through `d` (1 on start date).

```text
Original daily pace = max(0, T - S) / N
Expected cumulative savings by date d = S + (T - S) * k(d) / N
On track on date d iff C(d) >= expected cumulative savings by date d
Remaining-to-save now = max(0, T - current reserved)
Updated pace = Remaining-to-save / count of dates from today through D, inclusive
```

Compare **integer cents without rounding ambiguity** using multiplication: e.g. `(C(d)-S) * N >= (T-S) * k(d)`; if initial savings are above target, goal is immediately achieved. Show daily pace rounded **up** to cents, so following the displayed amount is sufficient. On/after deadline: if below target, show overdue and remaining amount (updated pace is `N/A`). Do not divide by zero.

**Example:** `$900` from November 1 through November 24 inclusive = **24 saving days**, `$37.50/day` initially. If on November 10 the goal reserve is `$150`, 15 dates remain inclusive (Nov 10–24), so updated pace = `$750/15 = $50/day`.

**Day-boundary caveat:** On the first date, the displayed expected cumulative amount is one day's target; if the system evaluates end-of-day status, it shall do so only after that local day ends. While the current day is in progress, display *provisional* on-track status and do not punish the user early.

### 8.3 Goal lifecycle

```text
draft -> active -> achieved -> fulfilled/archived
                  \-> overdue -> achieved (late) -> fulfilled/archived
active -> archived (with funds transfer)
achieved -> active/overdue if funds withdrawn below target (retain audit)
```

- **Achieved:** Savings target funded.
- **Fulfilled:** User actually spent from the goal toward its intended purchase; may consume all or part of saved funds.
- **Archived:** No longer an active goal; any remaining reserve must be explicitly released/transferred first.
- **Overdue:** Deadline passed and amount not achieved. Late achievement can still be recorded distinctly.

**DEFAULT:** Contributions can be reversed by a compensating transfer; after an achievement is reversed, the goal's live status is recalculated, but the event history remains. Future pet reward correction policy is documented separately.

---

## 9. Functional requirements: recurring bills

Recurring **bill** != recurring **budget**. A bill is an anticipated charge; its reserve is money set aside awaiting payment.

| ID | Requirement | Status |
|---|---|---|
| FR-BILL-001 | User shall define a recurring bill name, amount, schedule, category, and optional dedicated reserve. | ADOPTED DESIGN / MVP |
| FR-BILL-002 | MVP shall support monthly day-of-month scheduling; if day exceeds month length, use the month's last date. | DEFAULT / MVP |
| FR-BILL-003 | An upcoming bill may be automatically reserved/funded using normal funding priorities; **reserving is not paying**. | ADOPTED DESIGN / MVP |
| FR-BILL-004 | App shall show due, reserved, unpaid, paid, skipped, and overdue statuses. | DEFAULT / MVP |
| FR-BILL-005 | User shall confirm payment, which creates exactly one expense against the bill reserve and decreases total tracked money once. | DEFAULT / MVP |
| FR-BILL-006 | User may skip or edit a specific occurrence without changing future recurrence, or edit the recurrence prospectively. | DEFAULT / MVP |
| FR-BILL-007 | Any remaining reserve at closure/cancellation returns to unallocated funds via an explicit release event. | DEFAULT / MVP |
| FR-BILL-008 | A recurring bill due date does not itself prove that real payment happened. Do not silently record expenses solely because a date arrived. | DEFAULT / MVP |

**Scope control:** No bank or biller integration. A future user preference may permit automatic *self-reported* expense posting, but is not the MVP default.

---

## 10. Functional requirements: dashboard, history, and settings

### 10.1 Dashboard

| ID | Requirement | Status |
|---|---|---|
| FR-DASH-001 | Dashboard shall show tracked total, unallocated funds, amount reserved in budgets/bills/goals, and current-period income and expenses, with clearly labeled semantics. | ADOPTED DESIGN / MVP |
| FR-DASH-002 | Dashboard shall show near-term bills, active budgets, goal progress, and recent transactions. | DEFAULT / MVP |
| FR-DASH-003 | Financial values shall be derived from authenticated user's persisted records rather than hardcoded sample values. | ADOPTED DESIGN / MVP |
| FR-DASH-004 | Data changes shall update every affected screen consistently after successful commit; failures shall not display phantom balances. | DEFAULT / MVP |
| FR-DASH-005 | When balances are negative or funding incomplete, display a clear warning rather than hiding the condition. | DEFAULT / MVP |
| FR-DASH-006 | With no financial history, display zero/empty states and instructions rather than seeded fictional personal finances. | DEFAULT / MVP |

### 10.2 Spending summaries and history

| ID | Requirement | Status |
|---|---|---|
| FR-SUM-001 | Users shall view income, expense, and net movement for a selected week, month, or custom date range. | CONFIRMED + DEFAULT / MVP |
| FR-SUM-002 | Spending shall be breakable down by category and by budget, without charging a transaction twice. | DEFAULT / MVP |
| FR-SUM-003 | Dashboard and spending charts use **expense events**, never reservations or savings transfers as expenses. | ADOPTED DESIGN / MVP |
| FR-SUM-004 | Future-dated and scheduled-but-unpaid bills are excluded from *actual spent* values. | DEFAULT / MVP |

### 10.3 Settings

| ID | Requirement | Status |
|---|---|---|
| FR-SET-001 | Provide display name, time zone, log out, and budget/recurring-rule management entry points. | DEFAULT / MVP |
| FR-SET-002 | All visible interactive controls shall either function or be clearly labeled unavailable; no fake linked-card or password action. | DEFAULT / MVP |
| FR-SET-003 | Currency remains fixed to USD for MVP; multi-currency display/conversion is future scope. | DEFAULT / MVP |

---

## 11. Mathematical definitions and worked examples

### 11.1 Core equations

```text
TrackedTotal = OpeningBalance + Sum(Income) - Sum(Expense) + AuditedAdjustments
Unallocated = TrackedTotal - Sum(CurrentBudgetReserves)
                           - Sum(CurrentBillReserves)
                           - Sum(CurrentGoalReserves)
BudgetLimitVariance = BudgetLimit - Sum(ExpenseAssignedToBudgetPeriod)
BudgetOverage = max(0, -BudgetLimitVariance)
GoalRemaining = max(0, GoalTarget - GoalReserved)
```

Allocation flow (unallocated → reserve): `U -= x`, `R += x`, `Total unchanged`.

Covered budget expense of `e` with available reserve `r >= 0`:

```text
usedFromReserve = min(e, r)
usedFromUnallocated = e - usedFromReserve
Total -= e
BudgetReserve -= usedFromReserve
Unallocated -= usedFromUnallocated
BudgetPeriodSpent += e  # derived from expense record, never incremented independently
```

Direct expense of `e`: `Total -= e`, `Unallocated -= e`. Savings-funded expense: `Total -= e`, `GoalReserve -= min(e, available goal reserve)`; remainder, if allowed, must be explicitly assigned to a second funding source or unallocated—never silently invent reserve money.

### 11.2 Starting balance, budget setup, and overspend

| Step | Total | Unallocated | Rent reserve | Utilities reserve | Fun reserve | Groceries reserve | Fun limit variance |
|---|---:|---:|---:|---:|---:|---:|---:|
| Opening $200 | $200 | $200 | $0 | $0 | $0 | $0 | — |
| Paycheck +$1,500 | $1,700 | $1,700 | $0 | $0 | $0 | $0 | — |
| Fund $400 rent + $50 utilities + $75 fun + $300 groceries | $1,700 | **$875** | $400 | $50 | $75 | $300 | $75 |
| Expense $100 from fun budget | **$1,600** | **$850** | $400 | $50 | **$0** | $300 | **−$25** |

Check: `$1,600 = $850 + $400 + $50 + $0 + $300`. The fun budget shows **$25 over limit**, with **$25 covered by unallocated funds**; there is no negative reserve.

### 11.3 Goal funding, withdrawal, and purchase

From the previous state, contribute `$100` to TV savings:

- Total remains `$1,600`; unallocated becomes `$750`; TV goal reserve becomes `$100`.
- If user withdraws `$20` from TV to unallocated: total stays `$1,600`, unallocated `$770`, TV reserve `$80`.
- If user spends `$80` from TV savings: total becomes `$1,520`; TV reserve `$0`; unallocated stays `$770`.

The goal contribution is **not** income and not an expense. The purchase is an expense.

### 11.4 Period reset/release and refunding

A `$300` grocery reserve has `$240` in actual expenses and `$60` left. On period end transfer `$60` to unallocated; close historical record showing spent `$240` and within-limit `$60`. Next period begins with zero reserve. If auto-funding target is `$300` and sufficient unallocated funds exist, transfer **a new `$300`**, once. Old period's `$60` is **not** silently rolled over.

### 11.5 Insufficient recurring funding

If $100 is unallocated and scheduled allocations of $80 priority 1, $70 priority 2, and $50 priority 3 are outstanding: fund `$80`, fund `$20`, fund `$0`; show shortfalls `$0`, `$50`, `$50`. When user records `$120` new income, allocate remaining `$50` and `$50` in priority order, leaving `$20` unallocated. Do not refill already completed `$80` from the same occurrence.

### 11.6 Overspending when unallocated is exhausted

Suppose total `$40`, grocery reserve `$30`, unallocated `$10`. Grocery expense `$60`: use `$30` reserve and `$30` unallocated → total `−$20`, grocery reserve `$0`, unallocated `−$20`. Flag both **negative tracked total** and **unallocated funding deficit**. The application is recording user-reported activity; negative tracked total indicates a discrepancy/debt/unrecorded funds, not that a real bank is overdrawn.

---

## 12. Screen map and primary user journeys

### 12.1 Navigation plan

```text
App launch
  ├─ Not authenticated ── Welcome / Login / Register
  └─ Authenticated ────── (Initial balance onboarding if needed)
                              │
                              └─ Main navigation
                                   ├─ Home (dashboard)
                                   ├─ Spending (transactions + reports)
                                   ├─ Add (+ modal/action)
                                   ├─ Budgets (budget list / detail)
                                   ├─ Goals (goal list / detail)
                                   └─ Profile/Settings
```

**Design note:** Figma suggests a five-item bar `Home | Spending | + | Goals | Profile`; existing code has `Dashboard | Transactions | Budgets | Goals | Settings`. For MVP, **do not remove access to budgets to match the mockup**. Preferred resolution: use the Figma-style five main tabs with budgets accessible from Home and Spending **and** a clear dedicated Budgets screen, or retain six/alternative navigation if usability testing warrants it. Navigation layout is a presentation decision; all required destinations are mandatory.

### 12.2 Screen responsibilities

| Screen | Shows | Actions | Services |
|---|---|---|---|
| Welcome/Auth | Login/register/errors | Register, login, reset password if supported | Auth |
| Onboarding | Starting balance, time zone, explanation | Set opening funds | Ledger, profile |
| Dashboard | Total, unallocated, reserves, budget/goal highlights, pending bills | Navigate, quick-add | Summary, funding, billing |
| Add transaction | Income/expense, amount, category, date, source | Submit, cancel | Ledger |
| Spending/History | History, category sums, graphs | Filter, edit, reverse | Ledger, summary |
| Budgets list | Active periods and reserve/variance | New budget, fund, release | Budget, funding |
| Budget detail | Period limit, spent, reserve, events, funding shortfall | Adjust, pause, edit rule | Budget, ledger |
| Savings goals | Target, reserved, on-track, pace | New goal, contribute | Goals, funding |
| Goal detail | Progress history, remaining daily pace, deadline | Withdraw, edit, buy item | Goals, ledger |
| Bills | Next due and outstanding | Create rule, confirm/skip bill | Bills, funding |
| Settings | Profile, time zone, recurring rules, logout | Update settings, sign out | Profile, auth |
| Future pet | Pet state, level, health, achievements | View status | Pet evaluation |

### 12.3 Workflow: first-time use

1. Register / authenticate.
2. Confirm USD and preferred local time zone.
3. Enter opening balance, including `$0` if applicable.
4. Optionally create budgets, savings goals, recurring bills.
5. See initial unallocated balance and empty history; no invented sample financial entries.

### 12.4 Workflow: payday and auto-funding

1. Record income once (`type=income`, `$1,500`, date, source).
2. Commit journal entry, increase total and unallocated.
3. Run outstanding recurring funding rules in deterministic priority order.
4. For each, transfer available unallocated to destination, up to occurrence target; record shortages.
5. Show after-funding summary including unallocated money and destinations.
6. User may manually transfer leftover funds into savings goals at any time.

### 12.5 Workflow: grocery purchase, including overspend

1. Select expense and amount, assign grocery budget period.
2. Check available reserve; deduct as much as possible.
3. Cover remainder from unallocated (which can go negative if actual spending exceeds funds).
4. Commit the single purchase and linked postings atomically.
5. Show actual spending, reserved balance, and limit variance independently.
6. Update category summary and dashboard; future pet evaluates over-limit status later.

### 12.6 Workflow: savings plan

1. Create goal `TV`, `$900`, start Nov 1, deadline Nov 24.
2. Display initial `$37.50/day` required (24 inclusive dates).
3. Contribute funds manually from unallocated.
4. Display cumulative expected vs actual, and updated daily pace using remaining dates.
5. If target reached, show `achieved` and retain reserved funds.
6. On purchase, create a goal-funded expense; update account, goal reserve, and fulfillment status.

### 12.7 Workflow: recurring bill

1. Define rent `$400` monthly on day 1; assign priority.
2. On new occurrence, attempt to reserve money; report any shortfall.
3. When actual payment occurs, user confirms it and creates exactly one expense.
4. If occurrence is skipped, no expense is recorded; release or hold funds based on user's explicit choice.

### 12.8 Workflow: record correction

1. User chooses wrong `$100` expense and edits it to `$10` (or reverses/replaces).
2. Journal records correction linkage; affected period and reserve accounting are recalculated/reversed appropriately.
3. Dashboard and category summaries reflect `$10`, not `$110` or `$100`.
4. Recompute funding deficits and availability; automated transfers are not duplicated.
5. Future pet correction policy reconciles prior evaluations without duplicate XP events.

---

## 13. Application architecture and module responsibilities

### 13.1 Known stack

- React Native + JavaScript, Expo + Expo Router.
- Firebase Authentication (planned) and Cloud Firestore.
- Existing repository baseline at inspection: Expo `~57.0.28`, React Native `0.86.3`, Firebase `^13.1.0`; an SDK-upgrade PR is outstanding. **Check live `package.json` before changing dependencies.**
- Main current routes under `src/app/`; services currently under root `services/`; Firebase config under `config/`.

### 13.2 Logical layers

```text
Expo Router screens and reusable components
              │
       UI hooks / state
              │
       Domain use-cases
       ├── Ledger/accounting
       ├── Income/expense
       ├── Allocation/funding
       ├── Budget periods
       ├── Savings pace
       ├── Bills/scheduling
       └── Read-model summaries
              │
      Firestore repositories
              │
       Auth + Firestore
              │
    Future: trusted pet evaluator
```

### 13.3 Proposed file map (not claimed to exist)

```text
budgy-main/
├── AGENTS.md                    # Add pointer after team approves specification
├── docs/
│   └── BUDGY_REQUIREMENTS.md    # This file (suggested repository location)
├── src/
│   ├── app/
│   │   ├── _layout.js
│   │   ├── index.js              # dashboard
│   │   ├── transactions.js
│   │   ├── budgets.js
│   │   ├── goals.js
│   │   ├── settings.js
│   │   ├── login.js              # proposed
│   │   └── ...                   # proposed modal/detail routes
│   ├── components/              # presentation-only reusable controls
│   ├── hooks/                   # auth/session/query hooks
│   └── domain/                  # proposed pure business logic
│       ├── money.js
│       ├── ledger.js
│       ├── budgets.js
│       ├── savings.js
│       └── periods.js
├── services/                    # Firestore implementations and use cases
│   ├── transactions.js          # existing, must be revised
│   ├── balance.js               # existing, must be revised
│   ├── goals.js                 # existing, must be revised
│   ├── categories.js            # existing
│   ├── users.js                 # existing
│   ├── allocations.js           # proposed
│   ├── budgets.js               # proposed
│   └── bills.js                 # proposed
├── config/
│   ├── firebase-config.js
│   └── firebase.js
├── firestore.rules              # proposed, deployable security rules
├── firestore.indexes.json       # as needed
└── tests/                       # proposed, unit/integration cases
```

**Important:** Do not embed accounting calculations independently inside every screen. Centralize calculations in pure domain functions and keep service methods responsible for authenticated reads/writes. Avoid route files containing unrelated reusable non-route utilities.

### 13.4 Public domain-operation contracts (conceptual)

```javascript
recordIncome({ amountCents, effectiveDate, categoryId, description, requestId })
recordExpense({ amountCents, effectiveDate, sourceType, sourceId, categoryId, description, requestId })
reverseOrCorrectTransaction({ transactionId, replacement, requestId })
createBudgetRule({ name, categoryId, limitCents, frequency, fundingTargetCents, priority })
processBudgetPeriod({ budgetRuleId, periodKey, requestId })
moveFunds({ from: 'unallocated', toType: 'budget'|'bill'|'goal', toId, amountCents, requestId })
createSavingsGoal({ name, targetCents, startsOn, deadlineOn })
getSavingsProgress({ goalId, asOfLocalDate })
createRecurringBill({ amountCents, recurrence, priority, categoryId })
confirmBillPayment({ billOccurrenceId, effectiveDate, requestId })
getFinancialSummary({ userId, period })
```

**Contract rule:** All write operations shall verify authenticated ownership, validate cents/date/source, and commit one logically atomic financial operation. Contract shape is illustrative; consistent domain behavior is normative, not these exact function names.

---

## 14. Firestore data model and field dictionary

### 14.1 Recommended ownership layout

```text
users/{uid}
  profile / preferences / opening-state
  journal/{eventId}                 # immutable financial event + balanced postings
  transactions/{transactionId}      # searchable income/expense read-model or primary record
  categories/{categoryId}
  budgetRules/{budgetRuleId}
  budgetPeriods/{periodId}
  savingsGoals/{goalId}
  billRules/{billRuleId}
  billOccurrences/{occurrenceId}
  fundingRules/{fundingRuleId}
  operations/{requestId}            # idempotency receipts / status
  summaries/{summaryId}             # optional cached read model
  [future] pets/{petId}
  [future] petDailyEvaluations/{dayKey}
  [future] petAwards/{awardId}
```

This per-user subtree is a **proposed** safer organization, not a claim about the existing database. The current repo uses top-level `users`, `transactions`, `goals`, etc. A migration, adapter, or equivalent rigorously protected top-level design is required. Do **not** silently point a new client at a different collection and abandon existing records. Firestore security rules remain mandatory for either organization.

### 14.2 Common field standards

| Field | Type | Rules |
|---|---|---|
| `id` | string (document ID) | Stable, unique |
| `userId` | string | Must equal Firebase Auth UID; if subtree, derive from path |
| `createdAt` / `updatedAt` | Firestore Timestamp | Server-controlled where practical |
| `effectiveDate` | `YYYY-MM-DD` string | Valid date in user's chosen time zone |
| `occurredAt` | Timestamp | UTC point in time, when actual event captured |
| `amountCents` | integer | Currency minor units; positive input for income/expense events |
| `requestId` | string UUID | Unique idempotency key per logical action |
| `schemaVersion` | integer | Initial `1`; migrate explicitly |
| `status` | constrained string enum | Never free-text for domain state |

### 14.3 User document

`users/{uid}`

| Field | Type | Required | Meaning |
|---|---|---|---|
| `displayName` | string | Yes | User-selected name |
| `email` | string | Yes | From/auth verified identity, not client authority |
| `currency` | `'USD'` | Yes | MVP fixed currency |
| `timeZone` | IANA string | Yes | Period/day boundaries |
| `onboardingComplete` | boolean | Yes | Opening balance captured |
| `createdAt` / `updatedAt` | Timestamp | Yes | Audit metadata |
| `schemaVersion` | integer | Yes | Version |

**Opening funds** shall appear in the journal; `onboardingComplete` alone is not proof of account balance.

### 14.4 Financial journal

`users/{uid}/journal/{eventId}`

| Field | Type | Required | Meaning |
|---|---|---|---|
| `eventType` | enum | Yes | `opening_balance`, `income`, `expense`, `allocate`, `release`, `transfer`, `adjustment`, `reversal` |
| `amountCents` | integer | Yes | Magnitude (positive); postings carry sign |
| `effectiveDate` | date string | Yes | Financial period assignment |
| `requestId` | string | Yes | Idempotency |
| `relatedTransactionId` | string/null | No | Income/expense origin |
| `relatedBudgetPeriodId` | string/null | No | Budget affected |
| `relatedGoalId` | string/null | No | Savings goal affected |
| `relatedBillOccurrenceId` | string/null | No | Bill affected |
| `reversesEventId` | string/null | No | Corrective relation |
| `postings` | array of objects | Yes | `{accountKey, deltaCents}`; logical accounts include `external`, `unallocated`, `budget:{id}`, `bill:{id}`, `goal:{id}` |
| `createdAt` | Timestamp | Yes | Event creation |

**Journal invariant:** `sum(postings[*].deltaCents) == 0` **including external counterparty posting**. Example income `$100`: `external: −10000`, `unallocated: +10000`. Expense `$30` from grocery: `budget:grocery: −3000`, `external: +3000`. Allocation `$20`: `unallocated: −2000`, `goal:tv: +2000`. `TrackedTotal` is the sum of all internal account balances; external postings are excluded.

**Security caution:** Firestore rules alone cannot easily validate arbitrary journal posting arrays and all cross-document invariants. For robust financial writes use a trusted backend/Cloud Function or carefully constrained, transactionally validated operations; rules must restrict client operations so they cannot write unauthorized money or other users' records. For a class MVP, this may require deliberately limited allowed write shapes and server-side verified commands.

### 14.5 Transaction document

`users/{uid}/transactions/{transactionId}`

| Field | Type | Required | Meaning |
|---|---|---|---|
| `type` | `'income'|'expense'` | Yes | Financial type |
| `amountCents` | integer > 0 | Yes | Money amount |
| `description` | string | Yes | User label; may default to category label |
| `categoryId` | string/null | No | Category lookup |
| `effectiveDate` | date string | Yes | When money entered/left |
| `fundingSourceType` | enum | Expenses | `unallocated`, `budget`, `bill`, `goal` |
| `fundingSourceId` | string/null | Expenses | Specific reserve/occurrence ID |
| `budgetPeriodId` | string/null | If budget-linked | Spending performance grouping |
| `journalEventIds` | array<string> | Yes | Exact accounting linkage |
| `status` | `'active'|'reversed'` | Yes | Correction lifecycle |
| `supersedesId` | string/null | No | Correction chain |
| `createdAt` / `updatedAt` | Timestamp | Yes | Audit metadata |

The transaction record is not permission to double-apply the amount; the journal is authoritative. A read-model document may be derived atomically from journal command handling.

### 14.6 Category document

`users/{uid}/categories/{categoryId}`: `name:string`, `kind:'income'|'expense'|'both'`, `color?:string`, `icon?:string`, `isArchived:boolean`, created/updated timestamps. Category is a label and filter; it is **not** itself a fund reserve.

### 14.7 Budget rule

`users/{uid}/budgetRules/{budgetRuleId}`

| Field | Type | Required | Meaning |
|---|---|---|---|
| `name` | string | Yes | Groceries, entertainment, etc. |
| `categoryId` | string/null | Yes | Suggested transaction category |
| `frequency` | `'weekly'|'monthly'` | Yes | Recurrence |
| `limitCents` | integer > 0 | Yes | Performance ceiling |
| `autoFundingEnabled` | boolean | Yes | Auto-reserve on new period |
| `fundingTargetCents` | integer >= 0 | Yes | Amount to reserve each period; typically = limit |
| `fundingPriority` | integer >= 0 | Yes | Lower funds first |
| `startsOn` | date string | Yes | First active period |
| `status` | `'active'|'paused'|'archived'` | Yes | Future processing |
| `createdAt` / `updatedAt` | Timestamp | Yes | Audit |

### 14.8 Budget period

`users/{uid}/budgetPeriods/{periodId}`

| Field | Type | Required | Meaning |
|---|---|---|---|
| `budgetRuleId` | string | Yes | Parent template |
| `periodKey` | string | Yes | Unique by budget rule and start date, e.g. `monthly:2026-11` |
| `startsOn` / `endsOnExclusive` | date string | Yes | Exact boundaries |
| `limitCentsSnapshot` | integer | Yes | Limit at this period (preserve history) |
| `fundingTargetCentsSnapshot` | integer | Yes | Target at this period |
| `status` | `'open'|'closed'` | Yes | Lifecycle |
| `closedAt` | Timestamp/null | No | Closure time |
| `createdAt` | Timestamp | Yes | Audit |

**Derived data** (avoid independent mutation): `spentCents`, `reserveCents`, `remainingAgainstLimitCents`, `overageCents`, `fundingShortfallCents`, `releasedCents`. May be cached with atomic update/reconciliation. `periodKey` + rule ID is unique to prevent duplicate creation.

### 14.9 Savings goal

`users/{uid}/savingsGoals/{goalId}`

| Field | Type | Required | Meaning |
|---|---|---|---|
| `name` | string | Yes | E.g. Television |
| `description` | string | No | Optional notes |
| `targetCents` | integer > 0 | Yes | Required savings |
| `startsOn` | date string | Yes | Tracking start |
| `deadlineOn` | date string | Yes | Inclusive deadline; >= start |
| `initialReservedCents` | integer >= 0 | Yes | Seeded from an auditable transfer at creation, not invented balance |
| `status` | enum | Yes | `active`, `achieved`, `overdue`, `fulfilled`, `archived` |
| `achievedAt` / `fulfilledAt` | Timestamp/null | No | Lifecycle |
| `createdAt` / `updatedAt` | Timestamp | Yes | Audit |

**Derived:** current reserved, contributions by day, expected cumulative progress, daily pace, and on-track flag. Individual contribution/withdrawal is an `allocate`/`release`/`transfer` journal event linked to goal, not an untracked mutation of `currentAmount`.

### 14.10 Recurring bill rule and occurrence

**Bill rule:** `billRules/{id}`: `name`, `amountCents`, `categoryId`, `dayOfMonth` (1–31), `fundingPriority`, `autoFundingEnabled`, `status`, timestamps.

**Bill occurrence:** `billOccurrences/{id}`: `billRuleId`, `dueOn`, `amountCentsSnapshot`, `fundingTargetCentsSnapshot`, `status:'pending'|'partially_funded'|'ready'|'paid'|'skipped'|'overdue'`, `confirmedTransactionId?`, `paidAt?`, created/updated timestamps. Derived reserve/shortfall. Unique bill rule + month.

### 14.11 Funding rule and operation receipt

**Funding rule:** Can be embedded in budget/bill rule or normalized to `fundingRules`; do not duplicate a target in both places without a clear source. Required fields: source/destination, target per occurrence, priority, enabled, recurrence, version.

**Operation receipt:** `operations/{requestId}` records `operationType`, `status`, `resultEventIds`, `createdAt`, and failure metadata if applicable. Used with transactions to suppress replay from retries/network interruptions.

### 14.12 Future pet documents

See §17 for detailed fields. **Do not block MVP database work on pet collections.**

### 14.13 Firestore indexes / querying

Support user-scoped queries ordered by effective date, budgets by period/status, goals by deadline/status, and bills by due date/status. Configure Firestore composite indexes as query requirements emerge; do not fetch all users' transactions and filter client-side. Paginate history and validate access via rules.

---

## 15. Transaction integrity, automation, and lifecycle

### 15.1 Atomic write discipline

**DATA-ATOM-001** A logical financial action (expense, income, allocation, closing a period, confirming bill) must either commit **all related effects** or **none**.

**DATA-ATOM-002** Use Firestore transactions for read-modify-write operations, not a batch of independent `addDoc` calls. Retries must supply stable `requestId` and check `operations/{requestId}`.

**DATA-ATOM-003** Screens shall not independently write computed balances. Prefer deterministic domain commands and a single accounting service.

**DATA-ATOM-004** Restrict creation of journal events to authorized, validated operation paths. Firestore rules enforce ownership, but a trusted backend is recommended to enforce financial invariants reliably.

### 15.2 Scheduling and catch-up

**DATA-SCHED-001** Budget periods, monthly bills, and auto-funding shall use deterministic occurrence IDs based on rule and local period.

**DATA-SCHED-002** Reopening the app after multiple missed days shall catch up scheduled occurrences in chronological order, without duplicate postings.

**DATA-SCHED-003** Scheduling does **not** automatically mark a real bill paid. Only payment confirmation does that.

**DATA-SCHED-004** On a monthly boundary: close old budgets and release positive reserves, create new periods/occurrences, then fund outstanding targets from unallocated. Define exactly-once order within one trusted operation or idempotent stages.

**DATA-SCHED-005** If application time is untrustworthy or stale, use trusted server timestamps for finalized effects and handle conflicts predictably. User-entered effective date remains distinguishable from server posting time.

### 15.3 Retroactive changes

A transaction correction should alter historical financial calculations by reversing original effects and applying corrected effects. The chosen approach must prevent duplicated reserve consumption and make period reconciliation explicit. If a closed period is affected, re-evaluate its historical metrics and any release delta under an auditable adjustment rather than silently editing the past.

### 15.4 Offline behavior

At minimum, clearly show when a write has not been confirmed by Firestore. Do not optimistically announce a saved balance or pet award as final until its command succeeds. Queued offline commands, if supported, must retain request IDs and resolve conflicts safely; simple “view cached data while offline; require connection to confirm money moves” is acceptable for MVP.

### 15.5 Archiving and deletion

Use soft-delete/archive for financial entities referenced by historical journal entries; do not remove budget, category, goal, or bill data that past transactions need for accurate display. Privacy-related account deletion requires a deliberate authenticated process with appropriate cleanup.

---

## 16. Security, privacy, and nonfunctional requirements

### 16.1 Security / privacy

| ID | Requirement |
|---|---|
| NFR-SEC-001 | All user-specific reads and writes shall require Firebase Auth and enforce ownership server-side in Firestore rules. |
| NFR-SEC-002 | Never query all user transactions when UID is missing. Fail closed instead. |
| NFR-SEC-003 | A user must not read, modify, or delete another user's transactions, goals, budgets, bills, or pet. |
| NFR-SEC-004 | Prevent clients from writing arbitrary `userId`, `postings`, balances, or server-controlled fields without validation. |
| NFR-SEC-005 | Never commit `.env` secrets or private service-account credentials. Expo public config is not a security boundary; rules are. |
| NFR-SEC-006 | Do not log passwords, tokens, raw personally identifiable information, or unnecessary financial transaction contents. |
| NFR-SEC-007 | Log out clears protected UI state and detaches subscriptions. |
| NFR-SEC-008 | Automated security-rule tests shall include unauthorized cross-user access denial. |

### 16.2 Quality, usability, and reliability

| ID | Requirement |
|---|---|
| NFR-QA-001 | Input fields validate cents, nonnegative amounts where required, dates, valid destination IDs, and consistent ownership. |
| NFR-QA-002 | UI presents understandable loading, empty, success, validation, and network error states. |
| NFR-QA-003 | Monetary totals must be deterministic and exact to the cent; no floating-point drift. |
| NFR-QA-004 | Navigation shall work on supported mobile platforms, with accessible labels, usable touch targets, and readable text. |
| NFR-QA-005 | Date math shall be based on local calendar boundaries, including leap years, short months, and DST. |
| NFR-QA-006 | Paginate long histories; avoid unnecessary repeated reads; provide responsive feedback while loading. |
| NFR-QA-007 | Domain calculations shall have repeatable unit tests; Firestore transactions and rules shall have emulator tests. |
| NFR-QA-008 | `npm ci` and Expo-supported lint/diagnostics shall be documented; new dependencies must match the actual installed Expo SDK. |
| NFR-QA-009 | README shall describe development setup, environment variables, test commands, and how to use sample data without affecting production. |
| NFR-QA-010 | Financial operations shall be explainable from journal records and correlation IDs. |

### 16.3 Important disclaimers

Budgy is **a user-maintained planning tool**, not a bank, payment processor, or authoritative financial statement. Do not describe displayed tracked balance as verified bank balance. No sensitive account number storage is necessary for MVP.

---

## 17. Future Tamagotchi system and initial balancing

**Phase:** **FUTURE / POST-MVP**, but behavior specified now to avoid future conflicts. Game tuning values in this section are **ADOPTED INITIAL DEFAULTS**, intentionally configurable and revisable after playtesting. They shall not influence financial ledger correctness.

### 17.1 Core pet state

| Field | Initial design | Purpose |
|---|---|---|
| `xpTotal` | 0, never negative | Lifetime experience |
| `level` | 1 | Derived from thresholds |
| `health` | 100 | Current health points |
| `maxHealth` | 100 at level 1 | Increases with level |
| `state` | `healthy` / `tired` / `critical` / `fainted` | Visual state |
| `lastEvaluatedDay` | local date / null | No duplicated daily tick |
| `evolutionStage` | 0 | Future art progression |
| `createdAt` / `updatedAt` | timestamps | Persistence |

### 17.2 XP / exponential leveling

**PET-XP-001** XP is rewarded for achieving a savings goal and for finishing a budget period within its spending limit. Health changes are daily; XP achievements occur on actual **milestones**, not every app launch.

**PET-XP-002** Reward **+100 XP** for achieving a savings goal **once per goal achievement**, and **+40 XP** for closing a budget period within limit. A budget with no user spending/participation still needs a sensible anti-farming policy; initial default: award budget XP only if period had a positive funding target **and at least one real expense** associated with it.

**PET-XP-003** XP to advance from level `L` to `L+1` is `ceil(100 × 1.5^(L−1))` (integer points). Examples: L1→2 = 100, L2→3 = 150, L3→4 = 225, L4→5 = 338, L5→6 = 507. **Use one explicit rounding rule: ceiling.** `xpTotal` is cumulative; compute level using cumulative threshold sums, not by applying the single-level threshold to lifetime XP.

**PET-XP-004** `maxHealth = 100 + 20 × (level−1)` (HP). When leveling, increase both maximum and current health by **20 HP** without exceeding new max, so level-up feels beneficial but does not erase all prior damage.

**PET-XP-005** Reward only once per unique stable achievement ID. Corrections that undo a qualifying financial achievement shall create an explicit compensating XP entry (floor XP at 0; recompute level/health cap deterministically), rather than duplicate XP or silently ignore reversals.

**PET-XP-006** Evolution is planned as a cosmetic milestone **every five levels** (initial proposed: levels 5, 10, 15, ...), subject to available art; not MVP.

### 17.3 Health evaluation (once per completed local day)

**PET-HP-001** At the conclusion of each local day, evaluate **each eligible active savings goal** and **each eligible active spending budget period** independently, then apply the total change once. Use stable day and source IDs to avoid replays. An app being closed does not erase missed days; catch up safely on next trusted processing.

**PET-HP-002 — Savings goal status:** On each day `d` through deadline, compare **cumulative goal savings at end of day** to expected cumulative savings for `d` (see §8.2). If on track: **+2 HP**; if behind: **−3 HP**. Once achieved, goal stops participating in daily health (avoid indefinite free healing). If overdue and still incomplete: **−3 HP per overdue day**, capped at **−15 HP total per goal per overdue episode** until the deadline is revised, the goal is achieved, or the goal is archived. This cap prevents one missed goal from destroying the pet indefinitely.

**PET-HP-003 — Budget status:** Each calendar day with an active budget period and funding target: if cumulative period spending is within limit, **+2 HP**; if above limit, penalty **−(3 + min(7, floor(overageDollars / 25))) HP** for that budget/day. Example $25 over → −4 HP; $100 over → −7 HP; maximum −10 HP/day per budget. Use *cents* for comparisons: `floor(overageCents / 2500)`. This is an initial balancing heuristic and can be tuned.

**PET-HP-004 — Inactive/empty safeguards:** No daily healing or damage is awarded for a zero-funded inactive budget with no expenses and no configured target, or for a goal not yet started/archived. A user cannot farm unlimited healing from dozens of trivial empty budgets.

**PET-HP-005 — Daily cap:** Sum item effects but clamp final daily net change to **[−15, +10] HP**, then clamp `health` to `[0, maxHealth]`. Caps protect balance when many items are active. Each item still has its own recorded contributing effect for explanation.

**PET-HP-006 — Health states:** `healthy` > 60% max; `tired` > 25% to 60%; `critical` > 0% to 25%; `fainted` = 0 HP. For initial design **fainted is recoverable** (not permanent death). User can recover via later positive financial status; pet stays in the system. No financial penalty or data loss.

**PET-HP-007** Pet health/XP never changes money, budget limits, goal balances, or transaction history. Game is a read-only consumer of evaluated financial outcomes.

### 17.4 Example of daily aggregation

| Active item | End-of-day status | Base effect |
|---|---|---:|
| Grocery budget | Within limit | +2 HP |
| Fun budget | $25 over limit | −4 HP |
| TV savings goal | On track | +2 HP |
| Emergency savings goal | On track | +2 HP |
| Vacation savings goal | Behind | −3 HP |
| **Total daily** | | **−1 HP** |

Pet level/XP do not change from this ordinary daily evaluation. XP is earned from future **milestones**.

### 17.5 Source-of-truth and correction handling

- Store `petDailyEvaluations/{localDay}` with source snapshots, per-source health deltas, capped net delta, calculation version, and deterministic ID. Do not call `Date.now()` and grant health every screen render.
- A reliable implementation evaluates closed dates from historical ledger data at each date's cutoff, **not today's latest balance for prior days**.
- If user corrects a backdated transaction, re-evaluate affected historical outcomes and apply an auditable delta adjustment to health/XP (or replay pet state from a persisted initial checkpoint). Never simply apply a second full reward.
- Game tuning changes shall carry a `rulesVersion` so prior evaluations remain explainable. The team may decide whether to replay history when tuning; initial default: new rules apply prospectively unless correcting inaccurate records.

### 17.6 Future pet collections

`pets/{petId}`: `xpTotal:int`, `level:int`, `health:int`, `maxHealth:int`, `state:enum`, `evolutionStage:int`, `lastEvaluatedDay:date`, `rulesVersion:int`.

`petDailyEvaluations/{dayKey}`: `date`, `timeZone`, `sourceEvaluations:[{sourceType, sourceId, onTrack, deviationCents, baseDeltaHp}]`, `rawDeltaHp`, `appliedDeltaHp`, `rulesVersion`, `createdAt`, `correctionOf?`.

`petAwards/{awardId}`: `kind:'goal_achievement'|'budget_period_success'|'adjustment'`, `sourceId`, `amountXp`, `rulesVersion`, `awardedAt`, `reversesAwardId?`. Award ID deterministic per qualifying achievement.

---

## 18. Acceptance scenarios and tests

Every scenario should be an automated domain test where feasible and an end-to-end UI test/recorded manual verification for major flows. The following are canonical examples, not the complete eventual test suite.

| ID | Given | When | Required result |
|---|---|---|---|
| TEST-001 | New account | Initialize opening `$200` | Total=$200, unallocated=$200, no fictional income transaction |
| TEST-002 | From TEST-001 | Enter `$1,500` income | Total=$1,700, unallocated initially=$1,700 |
| TEST-003 | Total=$1,700; unallocated=$1,700 | Allocate rent $400, utilities $50, fun $75, grocery $300 | Total=$1,700, unallocated=$875, reserves sum=$825 |
| TEST-004 | TEST-003, fun limit=$75 | Spend $100 from fun | Total=$1,600, fun reserve=$0, unallocated=$850, variance=−$25 |
| TEST-005 | TEST-004 | Contribute $100 TV savings | Total=$1,600, unallocated=$750, goal reserve=$100 |
| TEST-006 | TV reserve=$100 | Withdraw $20 | Goal=$80, unallocated +$20, total unchanged |
| TEST-007 | Goal reserve=$80 | Purchase from goal for $80 | Goal=$0, total −$80, no double expense |
| TEST-008 | Grocery limit=$300; spent $240; reserve $60 | Close period | Return $60 to unallocated once; history preserved; next period starts at $0 |
| TEST-009 | `$100` unallocated; recurring targets $80/$70/$50 priorities 1/2/3 | Fund | $80/$20/$0 funded, $0/$50/$50 shortfalls |
| TEST-010 | After TEST-009 | Add $120 income; process again | Outstanding $50/$50 funded once; $20 left from income |
| TEST-011 | Budget reserve=$30, unallocated=$10, total=$40 | Record $60 budget expense | Reserve=$0, unallocated=−$20, total=−$20, warning shown |
| TEST-012 | $900 goal Nov 1–24 | Create goal | Initial pace $37.50/day, 24 days inclusive |
| TEST-013 | Goal has $150 on Nov 10 | View remaining pace | $750 / 15 days = $50/day; on-track status uses cumulative target |
| TEST-014 | Goal gets $450 on Nov 1 | Evaluate Nov 2–10 | No penalty merely for zero new daily deposits while cumulative reserve remains ahead |
| TEST-015 | Unpaid recurring rent occurrence | Due date passes | Mark due/overdue but do not record actual expense |
| TEST-016 | Rent due, funded, unpaid | Confirm payment twice due to retry | Exactly one expense and one reserve consumption |
| TEST-017 | Expense entered as $100 | Correct to $10 | Effective net spending $10; all dashboard/period/account calculations agree |
| TEST-018 | Account A logged in | Attempt to read/write account B Firestore paths | Access denied by rules |
| TEST-019 | Empty account | Open dashboard | Zeros, prompts, no hardcoded example money |
| TEST-020 | User offline | Submit financial edit | No false saved confirmation; safely retries or clearly fails |
| TEST-021 | Week crosses DST / month is February | Process periods and deadlines | Calendar-day boundaries remain correct |
| TEST-022 | Repeat same funding request ID | Retry transaction | No duplicate allocations, period openings, bill payments, or releases |
| TEST-023 | One budget over limit, two goals on track, one goal behind | Evaluate day | Individual effects summed, capped, applied once |
| TEST-024 | Pet gains XP reaching threshold | Level up | Exp threshold uses ceiling; max HP +20; current HP +20 capped |
| TEST-025 | Pet evaluated day D | Open app multiple times | No duplicate health changes for day D |

### 18.1 Feature-level definition of done

**Transaction flow:** Enter, persist, display, edit/reverse, and correctly account for each income/expense, including empty/failed/network cases.

**Budget flow:** Create weekly/monthly rule; fund manually/automatically; spend; show limit variance; cover overspend; close/reset/release; inspect historical period.

**Goal flow:** Create deadline/target; calculate pace and cumulative status; fund/withdraw; mark achieved; optionally record goal-funded purchase; persist throughout.

**Bill flow:** Define recurrence; create unique occurrence; reserve if funds available; show funding/overdue status; confirm payment once; skip/edit occurrence.

**Security:** Firebase Auth works, cross-user Firestore access is denied, userId missing never causes global reads.

**Integration:** All affected screens show the same amounts from the same journal; the app survives a restart and handles failed writes without diverging.

### 18.2 Required automated test categories

1. Pure integer-cent accounting arithmetic and reserve invariants.
2. Inclusive date arithmetic and period boundaries (Monday, month-end, leap year, DST).
3. Overspend coverage and negative unallocated amounts.
4. Auto-funding partial funding, priority ordering, exactly-once processing, and catch-up.
5. Savings pace and goal lifecycle, including early/late completion.
6. Journal correction/reversal, historical rebalance, derived report consistency.
7. Firebase rules with two different authenticated UIDs and unauthenticated requests.
8. Basic screen integration and persisted restart behavior.
9. Future daily pet evaluation, XP thresholds, health cap, and idempotency.

---

## 19. Current repository gap map

**Observation snapshot:** GitHub repository read on November 5, 2026. Earlier audit showed `main` commit `ab197e01bdea9c7d6bb2a6f7ec1c4573668409d8` (October 28); inspect latest commit again before implementation. These are **observed gaps**, not personal assignments.

| Existing asset | Observed behavior | Required alignment |
|---|---|---|
| `src/app/index.js` | Visual dashboard with sample values | Replace with signed-in, derived total/unallocated/reserves/summary |
| `src/app/transactions.js` | Placeholder | Add complete manual transaction entry/history/correction workflows |
| `src/app/budgets.js` | Placeholder | Add funded budgets, periods, reserve and variance display |
| `src/app/goals.js` | Local recurring task/habit UI (`useState`) | Replace/repurpose for **monetary savings targets** and persistent goal allocations |
| `src/app/settings.js` | Mostly visual sample settings | User profile, relevant preferences, management links, logout |
| `src/components/app-tabs.js` | Existing five tabs including Budgets | Keep Budgets reachable; reconcile with Figma once team selects navigation |
| `services/transactions.js` | Add/get transactions; optional userId; float-ish amount | Require authenticated ownership, integer cents, atomic accounting, edit/reverse |
| `services/balance.js` | Sum income−expense from transaction array | Add opening balance, reserve accounting, journal-based summary, safe numeric rules |
| `services/goals.js` | CRUD for goal docs with monetary target fields | Build auditable contribution transfers and lifecycle; enforce ownership |
| `services/categories.js` | Basic category persistence | Align with user-scoped category IDs and categories on transactions |
| `services/users.js` | Basic profile persistence | Integrate Auth UID and onboarding data |
| `config/firebase*.js` | Firestore setup; public env vars | Add Auth, security rules, indexes, migrations |
| `scripts/seed.mjs` | Seed example Firestore records | Adapt to new schema; seed **only** emulator/dev databases; never production accidentally |
| `AGENTS.md` | Expo/React Native version-aware guidance | **Later**, after team adoption, prepend/append link to this specification; preserve existing useful guidance |
| Tests/CI | No established project tests/CI observed | Introduce unit + emulator tests and PR checks |

**CRITICAL INTEGRATION WARNING:** The current `goals.js` UI models recurring task completion, but the team's clarified goals model is *monetary savings*. Do not connect the two unchanged simply to make a Trello card appear complete.

**Migration rule:** If existing Firestore top-level data must be retained, create an explicit migration plan/adapter and verify access controls; do not silently lose user records or seed production data.

---

## 20. Rules for developers and coding agents

### 20.1 Mandatory pre-implementation checklist

Before modifying a feature:

1. Read §§2–4 (definitions, scope, invariants), then the relevant requirement section, schema, and tests.
2. Read the *current* repository code and actual package versions; this specification may precede later code changes.
3. Identify impacted entities and operations: a savings transfer is not an expense; a budget limit is not a reserve; a bill reservation is not payment.
4. Confirm whether requested work is `MVP` or `FUTURE`. Do not implement post-MVP pet work while silently omitting financial requirements.
5. If instructions conflict with this document, stop and surface the conflict. Do not solve it by silently changing the financial model.
6. Preserve stable IDs, user ownership, audit records, integer cents, and idempotency.
7. Add or update tests referenced by affected requirement IDs.
8. Do not claim a feature complete based solely on matching Figma visuals.

### 20.2 Design constraints

- **Never double-count**: income, allocation, savings contribution, and expense are different event types.
- **Never count transfers as purchases** or automatically call a scheduled bill “paid.”
- **Never hide budget overspending** merely because unallocated funds covered it.
- **Never treat remaining spending budget as actual bank balance.**
- **Never duplicate auto-funding** on repeated paychecks or app restarts.
- **Never infer authentication** from a `userId` string supplied by a screen.
- **Never silently implement habits** as the savings-goal model.
- **Never mutate other users' records** or query without a signed-in UID.
- **Never assume Figma screenshots commit every pictured setting** to MVP.
- **Never update `AGENTS.md` as part of this document's creation**; link it only after team approval, in a separate change.

### 20.3 Suggested PR description format

```text
Summary:
Related requirement IDs: FR-..., DATA-..., TEST-...
Affected screens/services/collections:
Financial invariant impact:
Schema/migration impact:
Security-rule impact:
Tests run + result:
Screenshots/demo (for UI changes):
Open questions / deviations from specification:
```

### 20.4 Change control

A proposed change to the meaning of `total`, `unallocated`, budget reserve, goal reserve, daily pace, expense classification, or period closure is **an architecture change**, not a minor UI tweak. Update this document and relevant acceptance tests before or with the implementation. Keep version history and a short decision log.

---

## 21. Decisions and controlled assumptions

### 21.1 Settled product decisions

| Decision | Classification | Outcome |
|---|---|---|
| App focus | CONFIRMED | Manual money tracking, budget categories, deadline-based savings goals |
| Bank integration | CONFIRMED | None |
| Budget concept | CONFIRMED | Category spending allocation for a recurring period |
| Savings concept | CONFIRMED | Monetary target by date; per-day progress analysis |
| Pet scope | CONFIRMED | After functional financial application; not MVP |
| Pet concept | CONFIRMED | Daily health from financial status; XP from milestones; level boosts health capacity |
| Single pool and envelope-style reserves | ADOPTED DESIGN | One tracked total; unallocated plus named reserves |
| Overspending | ADOPTED DESIGN | Show negative budget **variance**; cover reserve shortfall from unallocated |
| Period end | ADOPTED DESIGN | Reset and release; rollover later only |
| Scheduled allocation | ADOPTED DESIGN | Auto-fund recurring targets; optional manual top-ups |
| Savings contribution | ADOPTED DESIGN | User initiates; reserve transfer, not expenditure |
| Savings on-track assessment | ADOPTED DESIGN | Cumulative expected savings by date |
| Insufficient funds | ADOPTED DESIGN | Priority order, partial funding, clear shortfall; preserve real expenses |
| Completed goal money | ADOPTED DESIGN | Remains reserved until release or purchase |
| Recurring bills | ADOPTED DESIGN | Reserve automatically; confirm actual payment |
| Financial record corrections | ADOPTED DESIGN | Auditable reversals and correct summary recalculation |
| Weekly/monthly calendar rules | ADOPTED DESIGN | Monday week, month boundaries, reset/release |
| Pet balancing | ADOPTED INITIAL DEFAULT | See §17; tunable post-MVP |

### 21.2 Implementer defaults subject to lightweight team review

These details are specified to avoid divergent implementations, but they are **not assertions of an earlier explicit team vote**:

- Initial supported currency = USD; time zone chosen at onboarding.
- Budget periods start at local Monday/first of month.
- New budgets do not capture existing transactions without explicit reassignment.
- Bill payments require confirmation; shorter months clamp the due date to last day.
- Funding priorities are user-configurable integers with stable tie-break ordering.
- Saving goals can be archived only after funds are transferred out.
- Negative unallocated funds represent a funding deficit and are clearly labeled.
- Savings expected progress is cumulative; current day's status is provisional.
- One user account tracks one conceptual financial pool.
- Core finance is available without pet dependencies.

### 21.3 Explicitly deferred policy decisions

None of these should block *financial MVP* development:

1. Fine-tuning pet reward/penalty values after playtesting.
2. Exactly which pet level art assets and evolution stages are used.
3. Optional rollover behavior and custom-length budget periods.
4. Optional daily reminders, biometric login, pet customization, and advanced bank-like features.
5. Final navigation tab styling and whether budget view is direct tab or prominently linked destination.

### 21.4 Recommended document adoption procedure

1. Review §2 (vision), §3 (scope), §4 (invariants), §11 (worked numbers), and §21 (decisions) as a team.
2. Resolve any objections in writing, update version, and get team agreement.
3. Place as `docs/BUDGY_REQUIREMENTS.md` (or equivalent) in the repository.
4. **Then**, in a separate change, link to it from `AGENTS.md` and README; inform teammates to have each coding agent read it before substantial changes.
5. Use requirement IDs and test IDs on Trello/GitHub tasks; keep one document version authoritative.

---

**End of Budgy SRS v1.0.**

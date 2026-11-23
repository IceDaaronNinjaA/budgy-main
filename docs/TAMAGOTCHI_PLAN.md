# Budgy Tamagotchi Integration Plan

## Purpose

This document describes how a basic Tamagotchi-style companion can fit into the
current Budgy application. It is an implementation plan for team discussion,
not a replacement for [`BUDGY_REQUIREMENTS.md`](../BUDGY_REQUIREMENTS.md).

The existing evolution reference is
[`assets/monsters/Eveluion.pptx`](../assets/monsters/Eveluion.pptx). The current
monster artwork lives in [`assets/monsters`](../assets/monsters).

## Scope and product boundary

The Tamagotchi system remains future/post-MVP work under the current product
requirements. Financial functionality must remain usable without any pet
dependency. The pet consumes trusted savings-goal outcomes; it must never change
money, balances, budget limits, goal balances, or transaction history.

The first implementation should stay intentionally small:

- The user chooses one of two starting babies: Ears or Slime.
- Completing a savings goal produces an XP and friendship outcome.
- XP is the only progression stat in the first version.
- Friendship controls branching evolution and whether the pet leaves.
- No feeding, health decay, daily care, accessories, alternate species, or
  advanced animations are required for this version.

The pet should not be rendered as a financial balance shortcut. The current
`Leaf.gif` usage in `src/screens/DashboardScreen.jsx` is decorative only and
should not be treated as an existing pet implementation.

## Confirmed evolution tree

The starting baby determines the evolution family:

```text
Ears
├── Ear 2
│   └── Ear 3
└── Leaf

Slime
├── Slime 2
└── Bird
```

The exact friendship thresholds are tunable. The application should store the
selected family and current form rather than infer the family from an image
filename.

## Core user experience

### 1. Choose a starting baby

After the pet feature is enabled, show a pet-selection screen with two choices:

- Ears
- Slime

Each choice should display its animated artwork, name, and a short description.
The selection is persisted once confirmed. A normal user flow should not allow
switching evolution families later, because switching would make the user's
friendship and XP history ambiguous. A separate reset flow can be considered
later and must be explicit.

### 2. Complete a savings goal

When a savings goal reaches its target, the savings-goal domain/service records
the achievement. A separate pet use case consumes that achievement and creates
one deterministic pet award.

The pet evaluator must use the goal's actual deadline and completion date. It
must not award XP merely because the dashboard rendered or because the app was
opened.

### 3. Apply XP and friendship

Initial proposed behavior:

| Goal result | XP | Friendship |
|---|---:|---:|
| Completed before the deadline | +100 | +10 |
| Completed on the deadline | +100 | 0 |
| Completed after the deadline | 0 | -10 |
| Significantly overdue or repeatedly missed | 0 | A larger configurable penalty |

These values are starting defaults for playtesting, not financial rules. They
should be kept in one versioned rules module so the team can tune them without
scattering numbers across screens and services.

For the basic version, friendship should be bounded to a documented range, for
example `-100` through `100`. The pet-leaves threshold should also be a named
configuration value, for example `-50`.

### 4. Determine evolution

Evolution becomes available after a configurable maturity requirement, such as a
minimum XP total or a minimum number of completed goals. The maturity rule must
be decided before implementation and then tested as a pure calculation.

At the evolution checkpoint:

- Neutral or lower friendship selects the base branch for that family.
- Higher friendship makes the alternate branch available.
- Very high friendship can unlock the advanced branch where one exists.
- A pet below the leave threshold leaves instead of evolving.

The first version should calculate the result deterministically. It should not
randomly choose between forms or ask the user to select an evolution after the
goal history has already determined it.

Examples:

- Ears can evolve into Leaf or Ear 2 based on friendship.
- Ear 2 can later evolve into Ear 3 when the next maturity requirement is met.
- Slime can evolve into Slime 2 or Bird based on friendship.

### 5. Pet leaves

If friendship falls below the configured leave threshold, the pet changes to a
terminal `left` state for that pet life. The app should show a clear result and
preserve all financial records and pet history. The first version does not need
to implement a return, recovery, or replacement-pet flow.

## Proposed state model

The basic pet document can begin with these fields:

```text
petId: string
userId: string
speciesLine: 'ears' | 'slime'
form: 'ears' | 'slime' | 'ear_2' | 'leaf' | 'ear_3' | 'slime_2' | 'bird'
status: 'active' | 'evolution_ready' | 'left'
xpTotal: integer >= 0
friendship: bounded integer
evolutionStage: integer
rulesVersion: integer
createdAt: timestamp
updatedAt: timestamp
```

The form enum should be confirmed against the final asset names before the
Firestore schema is implemented. Image files should be presentation assets,
not the source of domain state.

Pet goal awards should be idempotent and auditable:

```text
petAwards/{awardId}
kind: 'goal_completion'
sourceId: savingsGoalId or stable goal-achievement ID
xpDelta: integer
friendshipDelta: integer
completionTiming: 'early' | 'on_time' | 'late' | 'severely_late'
rulesVersion: integer
awardedAt: timestamp
```

`awardId` must be deterministic for the goal achievement. Reopening the app,
refreshing the dashboard, or retrying a request must not award XP or friendship
again.

If a completed goal is corrected or reversed, the system needs an explicit
correction policy before launch. The safest initial policy is an auditable
compensating pet award rather than silently rewriting history.

## Fit with the current architecture

The implementation should follow the existing project boundaries:

| Responsibility | Planned location |
|---|---|
| Pet selection route | `src/app/pet.js` or another agreed lowercase route |
| Pet selection/status screen | `src/screens/PetScreen.jsx` |
| Reusable pet card/evolution view | `src/components/` |
| XP, friendship, maturity, and evolution calculations | `src/domain/PetCalculations.js` |
| Pet validation | `src/validation/PetValidation.js` |
| Firestore reads, awards, and orchestration | `src/services/PetService.js` |
| Pet state subscription | `src/hooks/usePet.js` |
| Pet artwork | `assets/monsters/` |
| Unit and integration tests | `tests/PetCalculations.test.js` and pet service tests |

These modules should be created only when the corresponding feature is being
implemented. Do not add empty placeholders or a second Firebase initialization
module.

The pet service must derive ownership from the authenticated Firebase user. It
must not trust a `userId` supplied by a screen. Firestore rules must prevent one
user from reading or changing another user's pet or awards.

## Suggested delivery phases

### Phase 1: Confirm the rules and assets

- Confirm the maturity requirement for each evolution stage.
- Set the initial friendship range and leave threshold.
- Confirm the exact GIF-to-form mapping from the existing evolution deck.
- Decide whether a late completion receives any XP in the first release.
- Add the accepted pet rules to the authoritative requirements document if the
  team approves them.

### Phase 2: Implement pure domain logic

Add deterministic calculations for:

- goal timing classification
- XP and friendship deltas
- bounded friendship
- maturity/evolution eligibility
- evolution branch selection
- pet-leaves detection

These functions should have no Firebase, React, date-now, or UI dependencies.

### Phase 3: Persist pet state and awards

- Add the authenticated pet document.
- Add deterministic pet-award records.
- Make award creation idempotent.
- Add correction handling or explicitly defer corrections before launch.
- Add Firestore security rules and emulator tests.

### Phase 4: Add the user experience

- Add baby selection.
- Add pet status and current form.
- Show XP, friendship, and the next evolution requirement.
- Show a clear evolution result.
- Show the pet-leaves state.
- Keep the existing financial screens functional if pet data is unavailable.

### Phase 5: Integrate with savings goals

Connect the pet award use case to the existing savings-goal completion flow.
Do not duplicate goal-completion logic inside the pet screen. The pet should
consume a trusted goal event or service result.

## Initial acceptance criteria

- A new user can choose Ears or Slime once.
- The selected family persists after restarting the app.
- Completing a goal before its deadline awards the configured XP and friendship
  exactly once.
- Completing a goal on its deadline awards XP without a friendship bonus.
- Completing a goal late applies the configured penalty and does not award XP.
- Ears can reach Leaf or Ear 2 based on friendship.
- Ear 2 can reach Ear 3 after its next maturity requirement.
- Slime can reach Slime 2 or Bird based on friendship.
- A pet below the leave threshold enters the `left` state.
- Reopening the app or retrying the same request does not duplicate an award.
- Pet changes never modify money, balances, budgets, savings-goal amounts, or
  transaction history.
- A missing or failed pet read does not prevent the financial MVP from loading.

## Open decisions for the team

1. What XP total or number of completed goals makes a baby eligible to evolve?
2. What friendship thresholds select the alternate and advanced branches?
3. What counts as “significantly overdue” for the larger friendship penalty?
4. Does a late goal ever award XP, or is XP strictly limited to on-time goals?
5. Can a pet that leaves ever be recovered, or does the user start a new pet?
6. Should friendship be shown as a number, a bar, or only as descriptive status?
7. Which exact asset file represents each confirmed form in the evolution deck?

Until these decisions are approved, the values should remain configuration, not
hard-coded UI behavior.

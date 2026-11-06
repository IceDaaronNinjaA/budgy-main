# Budgy development instructions — humans and coding agents

**Source of truth:** Read [`BUDGY_REQUIREMENTS.md`](BUDGY_REQUIREMENTS.md) before implementing or refactoring a feature. Its scope, accounting invariants, data contracts, acceptance criteria, and §13.3 target architecture take precedence over generic starter-app examples here. If requirements conflict with the implementation or task, surface the conflict rather than silently changing the financial model. Inspect the current source and `package.json` before assuming a target module exists.

## Architecture and feature boundaries

- **Expo Router entrypoints** stay in `src/app/` with route-defined lowercase names. Keep them thin (e.g. `export { default } from '../screens/BudgetsScreen';`). Full UI screens belong in `src/screens/*Screen.jsx`.
- Reusable presentation components: `src/components/`; hooks and subscriptions: `src/hooks/use*.js`; Firestore I/O and use-case orchestration: `src/services/*Service.js`; pure finance logic: `src/domain/*Calculations.js`; validation: `src/validation/*Validation.js`; tests: `tests/*.test.js`.
- Follow the **target architecture**, but create a module only when it has real functionality. Do not create empty JavaScript placeholders or duplicate services. Preserve currently working routes and imported file paths while migrating code.
- Firebase app initialization currently lives in `config/firebase.js` and environment configuration in `config/firebase-config.js`. Do not add another Firebase initialization module without a coordinated migration. Never commit `.env` or credentials.
- The present Goals UI is not proof that financial savings goals are implemented. Distinguish visual prototypes and habit-style behavior from persistence-backed MVP savings goals. The Tamagotchi pet is **future/post-MVP**, not a replacement for financial MVP work.

## Non-negotiable finance and data rules

- Store monetary amounts as **integer cents** in new or migrated financial data. Treat legacy amount formats as a migration concern; do not silently reinterpret stored values.
- Maintain `total tracked balance = unallocated funds + budget reserves + savings reserves`. Allocating/reserving money is a **transfer**, not an expense, and must not decrease total tracked balance.
- Income adds funds; an actual expense decreases funds exactly once. Preserve budget overspending variance even if unallocated funds cover the shortfall.
- A recurring bill's reserved funds do not mean the bill was paid. Make repeated processing of recurring funding, bill/payment events, and future pet awards idempotent.
- Firestore reads and writes must be scoped to the authenticated user and backed by appropriate security rules; do not trust a screen-supplied `userId` as authorization. Avoid production seed writes while testing.
- Respect the requirement IDs and acceptance criteria in `BUDGY_REQUIREMENTS.md`. A feature is not complete merely because its UI renders.

## Workflow for each task

1. Identify relevant requirement IDs and whether the task is MVP, future, or a migration/refactor.
2. Read the existing screen, service, relevant data model, and dependencies; identify the smallest cohesive change.
3. Keep UI, persistence, validation, and financial calculations separate. Update affected imports, route wrappers, documentation, and tests.
4. Validate with `npm run lint` and an Expo bundle (e.g. `npx expo export --platform web --output-dir /tmp/budgy-web-check`) when routing/imports change. Add targeted tests as the project test runner becomes available. Report any known warnings and untested environments explicitly.
5. PRs should reference requirement IDs, state any schema/security/invariant impact, and list actual checks performed. Use `.github/PULL_REQUEST_TEMPLATE.md`.

---

This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

Use `bunx` instead of `npx` if the project uses bun (`bun.lock` present).

```bash
npx expo install <package>  # ALWAYS use instead of npm/yarn/pnpm/bun add — resolves SDK-compatible versions
npx expo start              # start the dev server
npx expo lint               # lint
# TypeScript typecheck only if/when TypeScript is configured for this project
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
```

Run lint and relevant checks before declaring any task done; run TypeScript typecheck only if a TypeScript configuration and script exist.

## Navigation & Routing

- Use **Expo Router** for navigation. Routes live in `src/app/` as thin entrypoints; `_layout.js` defines the current navigator. Keep screen implementations in `src/screens/`, and other components, hooks, and services outside `src/app/`.
- Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`.
- Docs: https://docs.expo.dev/router/introduction.md

## Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`) — no local Xcode or Android Studio required. Run EAS CLI as `bunx eas-cli <command>` in Bun projects, or `npx eas-cli@latest <command>` otherwise; substitute that for bare `eas` in docs examples.
Docs: https://docs.expo.dev/eas/index.md

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md

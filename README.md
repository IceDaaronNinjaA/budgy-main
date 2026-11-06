# Budgy

Budgy is a mobile-first personal finance application built with **Expo, React Native,
JavaScript, and Firebase Firestore**. Its financial MVP focuses on manual income and
expense tracking, budget allocations, and deadline-based savings goals. A Tamagotchi-style
pet is planned for **after** the financial MVP.

> This project is under active development. A screen being present does not mean
> its underlying financial or database functionality is complete.

## Project documentation

- **[Requirements and acceptance criteria](BUDGY_REQUIREMENTS.md)** — authoritative
  scope, accounting rules, data models, and proposed architecture.
- **[Development and coding-agent rules](AGENTS.md)** — required conventions
  for contributors and coding assistants.
- **[Claude instructions](CLAUDE.md)** — loads the shared agent rules and requirements.
- **[Documentation index](docs/README.md)** — how the documentation fits together.
- **[Domain module guidance](src/domain/README.md)** — where financial calculations belong.
- **[Validation module guidance](src/validation/README.md)** — input and data validation.
- **[Testing guidance](tests/README.md)** — planned test organization.

## Getting started

1. Install Node.js and the dependencies appropriate for the repository.
2. Run `npm ci` from the repository root.
3. Set up required local Firebase environment variables for features that use
   Firestore. Do not commit `.env` files or credentials.
4. Run `npx expo start` and follow its prompt to launch the app.

### Checks

```bash
npm run lint
npx expo-doctor
npx expo export --platform web --output-dir /tmp/budgy-web-check
```

Expo Doctor may flag SDK patch-version mismatches until the separate dependency
update is merged. Do not silently upgrade dependencies in an unrelated feature PR.

## Code layout

| Path | Responsibility |
| --- | --- |
| `src/app/` | Expo Router route entrypoints and navigation layout |
| `src/screens/` | Screen implementations (`*Screen.jsx`) |
| `src/components/` | Reusable presentation components |
| `src/hooks/` | React hooks |
| `src/services/` | Firestore access and use-case orchestration (`*Service.js`) |
| `src/domain/` | Pure financial calculations (modules added as needed) |
| `src/validation/` | Input and data validation (modules added as needed) |
| `tests/` | Automated tests (added with implemented features) |
| `config/` | Existing Firebase configuration |

The target file map and naming rules are in
[requirements §13.3](BUDGY_REQUIREMENTS.md). Do not create empty code modules just
to match the proposed tree.

## Contributing

Open a focused branch and pull request into `main`. Read the requirements and
agent guidance before making changes, and use the
[pull request template](.github/PULL_REQUEST_TEMPLATE.md) to record the
requirements affected and checks performed.

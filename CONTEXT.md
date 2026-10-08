# Project Context

## Project Overview

JuntadApp - Mobile app to organize meetups (juntadas). Focus: split expenses and track board/card game scores. Local-first and fast for use during meetups.

## Product Goals

- Fast meetup creation
- Reuse frequent friend groups
- Minimal manual input
- Good mobile UX (big touch targets, few steps, clear feedback)
- Offline-friendly with local persistence
- Extensible architecture

## Current Features

- People management (create, list, soft delete)
- Friend groups (create with members, list, soft delete)
- Create a juntada: name, today's date, participants (manual selection or loaded from a saved group, then adjustable)
- Record expenses: description, amount, payer, subset of participants
- Equal split with deterministic integer remainder
- Settlement with two modes: direct payments and debt minimization (default)
- Juntada detail: expenses list, totals, transfers, balances
- Juntadas list with date, participant count and total spent
- SQLite persistence with migrations

Games module: not started (placeholder screen inside juntada detail).

## Architecture

```
UI (src/app, Expo Router screens)
  -> Repositories (src/infrastructure/persistence, SQL + row mapping)
    -> Domain (src/domain, pure TypeScript business rules)
```

- Domain has zero Expo/React Native imports; unit-tested without rendering anything.
- SQLite is the single source of truth. Screens read on focus (`useFocusEffect`) instead of keeping a client-side cache.
- IDs generated with `expo-crypto.randomUUID()` in `src/infrastructure/id.ts`.

## Tech Stack

- Expo SDK 57, React Native 0.86, TypeScript (strict)
- Expo Router (file-based routing, typed routes enabled) - routes in `src/app`
- expo-sqlite (`SQLiteProvider` + `onInit` migration hook)
- expo-crypto (UUIDs), dayjs (dates)
- Jest + ts-jest (domain tests), ESLint with `eslint-config-expo`
- Installed but not used yet: Zustand, zod, react-hook-form (reserved for shared state and form validation when needed)

## Folder Structure

```
src/app          - Expo Router screens (every file is a route)
src/domain       - pure business logic (people, groups, get-togethers, expenses, common)
src/infrastructure
  /persistence   - migrations + repositories (people, groups, get-togethers, expenses)
  /id.ts         - UUID generator
src/ui           - theme.ts, format.ts, shared components (Button, TextField, Card...)
tests/domain     - unit tests for domain logic
docs/adr         - architectural decision records (none yet)
```

## Domain Model

- Person (id, name, deletedAt, createdAt)
- Group (id, name, memberIds, deletedAt, createdAt)
- GetTogether (id, name, date, status active|closed, closedAt, participantIds snapshot, timestamps)
- Expense (id, getTogetherId, payerId, description, amountInt, participantIds, timestamps, deletedAt)
- Balance (personId, net = paid - owes)
- Transfer (from, to, amount)

## Data Model (SQLite, migration v1)

Timestamps are INTEGER epoch milliseconds. Soft deletes via `deleted_at`.

- people(id, name, deleted_at, created_at)
- groups(id, name, deleted_at, created_at)
- group_members(group_id, person_id, position)
- get_togethers(id, name, date, status, closed_at, created_at, updated_at)
- get_together_people(get_together_id, person_id, position)
- expenses(id, get_together_id, payer_id, description, amount_int, created_at, updated_at, deleted_at)
- expense_participants(expense_id, person_id, position)

`position` preserves participant order (it decides who absorbs the split remainder).

## Main Business Rules

- Money stored as integer ARS (no cents)
- Equal split: remainder distributed to the first participants (index 0..r-1)
- Soft delete for people, groups and expenses (preserve history)
- Participants snapshot per juntada (history does not break if people change)
- Editing or closing a juntada: NOT implemented yet (open product decision)

## Expense Calculation

All in `src/domain/expenses/expense-calculator.ts`:

- `calculateShares(expense)`: per-participant amount via `splitEvenly`
- `calculateBalances(expenses)`: net = paid - owes (deleted expenses ignored)
- `calculateDirectTransfers(expenses)`: debtor -> creditor directly against original payers
- `minimizeTransfers(expenses)`: default mode

## Debt Minimization Algorithm

Greedy: repeatedly match the largest creditor with the largest debtor until cleared. Produces a financially equivalent result with fewer transfers than the direct mode.

## Supported Games

None yet. Planned: Truco first, then Generala, Skull King.

## Games Architecture (planned)

- Generic game definition: rules, scoring, win condition, rounds
- Game logic as pure domain code under `src/domain/games/<game>/` with unit tests
- Scoring UI rendered per game inside the Juegos tab of the juntada detail

## Navigation (implemented)

```
(tabs)
├── index   - Juntadas (list + create button)
└── grupos  - Personas y grupos
Stack (root)
├── juntada/nueva        - create juntada (modal)
├── juntada/gasto-nuevo  - add expense (modal, ?id= getTogether)
└── juntada/[id]         - detail with segmented Gastos | Juegos
```

Typed routes are enabled: use template literals (`/juntada/${id}`) or the
`router.push({ pathname, params })` object form.

## State Management

- No global store yet: each screen loads from SQLite on focus.
- Zustand is installed for when real shared client state appears; do not add a store "just in case".

## Persistence

- `expo-sqlite`, database `juntadapp.db`, WAL mode, foreign keys ON.
- Migrations: `src/infrastructure/persistence/migrations.ts`, versioned with `PRAGMA user_version`.
- To add a migration: append `{ version: N + 1, sql }` to `MIGRATIONS`. Never edit an applied migration.
- Repositories take the `SQLiteDatabase` as first argument (obtained in screens with `useSQLiteContext()`).

## Testing Strategy

- Unit tests for domain logic only (no component tests in v1), in `tests/domain`.
- Every new algorithm (splits, balances, game rules) must ship with tests.

## Important Design Decisions

- Integer money (no cents) per user request
- Soft delete to preserve historical integrity
- Participants snapshot per juntada
- Domain kept separate from UI and persistence
- Expo Router over React Navigation (project instruction in AGENTS.md; decided while no navigation code existed yet)
- IDs via `expo-crypto` instead of `uuid` (Expo-recommended module)

## Known Limitations

- Juntada date is always today (no date picker yet)
- Cannot edit a juntada, its participants or its expenses (delete + re-create only)
- Cannot close/reopen a juntadas; status column exists but is always `active`
- Groups cannot be edited after creation (create/delete only)
- Web not configured or tested
- Games module not started

## Future Features

- Date picker, edit/close juntadas, edit people/groups
- Games: Truco, Generala, Skull King + game history
- Statistics (wins, rankings)
- Backend/sync/login: not planned (local-first by decision)

## Development Guidelines

1. Domain first, with tests, before touching UI.
2. Ask before implementing large features or inventing requirements.
3. Prefer simple solutions; avoid overengineering and unnecessary dependencies.
4. Keep UI and business logic separated; TypeScript strict, no unjustified `any`.
5. Code and technical documentation in English; UI text in Spanish.
6. Destructive actions require confirmation (`Alert.alert`).
7. Update this file whenever a feature or architectural decision lands.
8. Before declaring a task done: `npm test`, `npm run lint`, `npm run typecheck`.

## How To Add A New Feature

1. Pure logic -> `src/domain/<area>/` + tests in `tests/domain`.
2. Persistence -> repository function in `src/infrastructure/persistence`.
3. UI -> new screen in `src/app` (Expo Router) or extend an existing one.
4. Update README.md and this file.

## How To Add A New Game

1. Domain: `src/domain/games/<game>/` with pure rules (scoring, rounds, win condition) + unit tests.
2. Persistence: matches/rounds storage (design when the first game lands).
3. UI: render the game scorer inside the Juegos tab of `src/app/juntada/[id].tsx`; keep game-specific logic out of the screen.

## Important Files

- `CONTEXT.md` - this file (AI-facing project context)
- `README.md` - developer-facing overview
- `diseño.md` - original product requirements (Spanish)
- `src/domain/expenses/expense-calculator.ts` - splits, balances, transfers
- `src/infrastructure/persistence/migrations.ts` - schema versions
- `src/app/_layout.tsx` - root layout (SQLiteProvider + Stack)

## Current Project Status

- Phase 0 setup complete (Expo SDK 57, deps, jest, eslint)
- Expense domain + tests passing
- SQLite schema/migrations + repositories done
- Basic UI done: juntadas list, create juntada, juntada detail with expenses and settlement, people/groups management
- Verified: `npm test` (4 passing), `npm run lint`, `npm run typecheck`, `npx expo-doctor` (21/21), production bundle export

Next steps: edit/close juntadas + date picker, then the games architecture (Truco first).

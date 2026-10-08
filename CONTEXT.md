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
- Games module: matches per juntada (Truco, Generala, Skull King) with live scorer, history and multiple matches per game

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
src/domain       - pure business logic (people, groups, get-togethers, expenses, games)
  /games         - game rules: game-types, truco/, generala/, skull-king/
src/infrastructure
  /persistence   - migrations + repositories (people, groups, get-togethers, expenses, matches, per-game)
  /id.ts         - UUID generator
src/ui           - theme.ts, format.ts, shared components (Button, TextField, Card...)
  /games         - scorer components (GamesSection, TrucoScorer, GeneralaScorer, SkullKingScorer)
tests/domain     - unit tests for domain logic (expenses, games)
docs/adr         - architectural decision records (none yet)
```

## Domain Model

- Person (id, name, deletedAt, createdAt)
- Group (id, name, memberIds, deletedAt, createdAt)
- GetTogether (id, name, date, status active|closed, closedAt, participantIds snapshot, timestamps)
- Expense (id, getTogetherId, payerId, description, amountInt, participantIds, timestamps, deletedAt)
- Balance (personId, net = paid - owes)
- Transfer (from, to, amount)
- Match (id, getTogetherId, game truco|generala|skull-king, status active|finished, teamSize for truco, players snapshot with team, timestamps)
- Game-specific: TrucoRound (team1Points, team2Points), GeneralaEntry (box, points, tachado), SkullKingRoundEntry (round, bid, tricks, bonus)

## Data Model (SQLite, migrations v1 + v2 + v3)

Timestamps are INTEGER epoch milliseconds. Soft deletes via `deleted_at`.

v1:

- people(id, name, deleted_at, created_at)
- groups(id, name, deleted_at, created_at)
- group_members(group_id, person_id, position)
- get_togethers(id, name, date, status, closed_at, created_at, updated_at)
- get_together_people(get_together_id, person_id, position)
- expenses(id, get_together_id, payer_id, description, amount_int, created_at, updated_at, deleted_at)
- expense_participants(expense_id, person_id, position)

v2 (games):

- matches(id, get_together_id, game, status, team_size, created_at, finished_at) - hard delete (cascade)
- match_players(match_id, person_id, team, position) - player snapshot, team only for truco
- truco_rounds(id, match_id, round_number, winner_team, points, created_at, UNIQUE(match_id, round_number))
- generala_entries(match_id, person_id, box, points, tachado, created_at, PK(match_id, person_id, box))
- skull_king_rounds(match_id, round_number, person_id, bid, tricks, bonus, created_at, PK(match_id, round_number, person_id))

v3 (truco hands store both teams at once):

- truco_rounds rebuilt: id, match_id, round_number, team1_points, team2_points, created_at, UNIQUE(match_id, round_number) — legacy rows migrated from winner_team/points

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

- Truco: score per team to 30, split display 15 malas + 15 buenas, 1v1/2v2/3v3. Each hand is loaded in a single form with one numeric input per team (no chips/selector): the hand adds its points to both totals at once. First to reach 30 wins (overshoot allowed).
- Generala: standard Argentine scoring sheet (11 boxes). Upper section 1-6 free entry, +35 bonus when the upper sum is >= 63. Lower boxes use fixed values chosen on entry: escalera 20/25, full 30/35, poker 40/45, generala 50/55, doble generala 100/105. Any box can be tachado (= 0). Sequential turns: the app shows whose turn it is; the current player loads points + box for a single play and then the turn passes to the player with the fewest filled boxes (players with a complete sheet are skipped). Game ends when every player filled all 11 boxes.
- Skull King: 10 rounds; every player gets one card per round played (round N => N cards), so bids and tricks are capped by the round number (the UI only shows the round being played, not the card count). Per player bid + tricks + bonus. Exact bid 0 => +10 * round (10 in round 1, 20 in round 2, and so on); exact bid N => 20*N; miss => -10 * |bid - tricks|. Bonuses only apply when the bid is exact: combat presets (Sirena beats Skull King +50, Pirata beats Sirena +20, Skull King beats Pirata +30, repeatable) plus a free +/- amount field.

## Games Architecture

- Shared types in `src/domain/games/game-types.ts` (GameId, Match, MatchPlayer, TrucoTeam/TrucoTeamSize).
- Pure rules per game in `src/domain/games/<game>/` with unit tests in `tests/domain/games/<game>/`.
- Persistence: `matches` + `match_players` shared, plus one table per game; repositories in `src/infrastructure/persistence` (`matches-repository.ts`, `truco-repository.ts`, `generala-repository.ts`, `skull-king-repository.ts`).
- UI: scorer components in `src/ui/games/`, rendered by the route `juntada/partida` (one screen dispatches by `match.game`). Game logic never lives inside screens.

## Navigation (implemented)

```
(tabs)
├── index   - Juntadas (list + create button)
└── grupos  - Personas y grupos
Stack (root)
├── juntada/nueva        - create juntada (modal)
├── juntada/gasto-nuevo  - add expense (modal, ?id= getTogether)
├── juntada/juego-nuevo  - start match (modal, ?id= getTogether, ?game= preselect)
├── juntada/partida      - match scorer/history (?match= matchId)
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
- Match players/teams cannot be edited after creation (delete and re-create the match)
- Skull King: only the last saved round can be undone; previous rounds cannot be edited
- Skull King: matches saved before the "one card per round" rule change keep their stored bids; rounds are scored and validated under the new rules (bid/tricks validation only applies when saving a new round)
- Truco: no automatic envido/flor/falta tracking, points per hand are entered manually

## Future Features

- Date picker, edit/close juntadas, edit people/groups
- Game statistics (wins, rankings)
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

1. Domain: `src/domain/games/<game>/` with pure rules (scoring, rounds, win condition) + unit tests in `tests/domain/games/<game>/`.
2. Persistence: follow the existing pattern - migration `{ version: N + 1 }` adding a match table (plus shared `matches`/`match_players`), then a repository with `db` as first argument.
3. UI: scorer component in `src/ui/games/` + dispatch branch in `src/app/juntada/partida.tsx`; keep game-specific logic out of the screen. Add the game id to `GAME_LABELS` and to the picker in `juntada/juego-nuevo.tsx`.

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
- SQLite schema/migrations (v1 + v2 + v3) + repositories done
- Basic UI done: juntadas list, create juntada, juntada detail with expenses and settlement, people/groups management
- Games module done: Truco, Generala and Skull King (domain + tests, migration v2, repositories, setup screen, scorers, match list in the Juegos tab)
- Verified: `npm test` (48 passing), `npm run lint`, `npm run typecheck`

Next steps: edit/close juntadas + date picker, then game statistics.

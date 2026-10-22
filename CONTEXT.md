# Project Context

AI-facing source of truth for JuntadApp. Read this file before starting any feature. Update it whenever a feature, migration or architectural decision lands (rule 7 in Development Guidelines). The goal: attack a new feature knowing which sections/files to touch without re-reading the whole codebase.

## Project Overview

JuntadApp - Mobile app to organize meetups (juntadas). Focus: split expenses and track board/card game scores. Local-first and fast for use during meetups.

## Product Goals

- Fast meetup creation
- Reuse frequent friend groups
- Minimal manual input
- Good mobile UX (big touch targets, few steps, clear feedback)
- Offline-friendly with local persistence
- Extensible architecture

## Tech Stack

- Expo SDK 57, React Native 0.86, TypeScript (strict)
- Expo Router (file-based routing, typed routes enabled) - routes in `src/app`
- expo-sqlite (`SQLiteProvider` + `onInit` migration hook), expo-crypto (UUIDs), dayjs (dates)
- Jest + jest-expo (`jest.config.js`, transform via babel-preset-expo). Do NOT switch to ts-jest: it was tried and broke on React Native imports; the jest-expo preset is the working setup.
- ESLint with `eslint-config-expo`
- CI: GitHub Actions (`.github/workflows/tests.yml`) runs `npm run typecheck`, `npm run lint`, `npm test` on every push/PR to `master`
- Installed but not used yet: Zustand, zod, react-hook-form (reserved for real shared state / form validation needs; do not add a store or validation lib "just in case"), expo-haptics, expo-blur

## Architecture

```
UI (src/app, Expo Router screens)
  -> Repositories (src/infrastructure/persistence, SQL + row mapping)
    -> Domain (src/domain, pure TypeScript business rules)
```

- Domain has zero Expo/React Native imports; unit-tested without rendering anything.
- SQLite is the single source of truth. Screens reload on focus (`useFocusEffect` + a local `load()` function) instead of keeping a client-side cache; after any mutation call `load()` again.
- IDs generated with `expo-crypto.randomUUID()` in `src/infrastructure/id.ts`.
- Path alias: `@/` maps to `src/` (use `@/domain/...`, `@/ui/...` from screens).

## Feature Map

State of each feature and the exact files that implement it. Start here to know what already exists before coding.

### 1. People and groups (complete)

- CRUD: create, list, edit (inline), soft delete. People are never hard-deleted (history).
- Domain: `src/domain/people/person-types.ts`, `src/domain/groups/group-types.ts` (types only; rules live in repositories).
- Repos (`src/infrastructure/persistence`):
  - `people-repository.ts`: `createPerson`, `listPeople` (excludes soft-deleted; the options shown in pickers), `listAllPeople` (INCLUDES deleted; used only to display names of historical match players), `updatePerson`, `deletePerson` (soft).
  - `groups-repository.ts`: `createGroup` (group + members in a transaction), `listGroups` (with member names), `updateGroup` (rewrites `group_members` delete+reinsert with `position`; members soft-deleted in the people table are NOT shown as options but ARE kept in the group), `deleteGroup` (soft).
- UI: `src/app/(tabs)/grupos.tsx` — people list (tap pencil to edit inline: an edit form appears at the top of the screen driven by local `editId` state; confirm before discarding edits), groups list with member checkbox picker, both lists filtered by the same `SearchField` query.
- Gotchas: editing a group replaces the full member selection (checkboxes start pre-checked from current members); destructive deletes use `Alert.alert` confirmation.

### 2. Juntadas (create + list + detail)

- Create: name, today's date only, participants (manual multi-select or load from a group, then adjustable).
- Domain: `src/domain/get-togethers/get-together-types.ts`.
- Repo: `get-togethers-repository.ts` (`createGetTogether` + participant snapshot rows in `get_together_people`, `listGetTogethers`, `getGetTogether`...).
- UI:
  - `src/app/(tabs)/index.tsx` — list: name, date, participant count, total spent; create button opens modal.
  - `src/app/juntada/nueva.tsx` — modal: group chip to preload selection, people checkboxes with SearchField, EmptyState on no matches; selection preserved when filtering.
  - `src/app/juntada/[id].tsx` — detail: header with balances/transfers (Liquidación section: "Saldar" per transfer opens pago-nuevo prefilled, "Compartir" shares summary text), segmented control Gastos | Juegos. Computes everything at render from expenses + settlements via `expense-calculator` (no stored balances).
- Participants are a SNAPSHOT: later changes to people/groups do not affect existing juntadas (decided).
- NOT implemented: edit juntada (name/date/participants), date picker (always today), close/reopen (`status` column exists, always `active`). Open product decision.

### 3. Expenses (complete)

- Create/edit/soft delete; equal split; payer + subset of participants.
- Domain: `src/domain/expenses/expense-types.ts` + `expense-calculator.ts` (see Expense Calculation section).
- Repos: `expenses-repository.ts` (`createExpense` + `expense_participants`, `listExpenses`, `updateExpense` which rewrites participants, `deleteExpense` soft).
- UI: `src/ui/expenses/ExpenseForm.tsx` is a REUSABLE form (description, amount, payer chip, participant checkboxes, validation, SearchField) used by both `src/app/juntada/gasto-nuevo.tsx` (modal `?id=`) and `src/app/juntada/gasto-editar.tsx` (modal `?id=&expenseId=`). Expense list + edit/delete actions live in `src/app/juntada/[id].tsx` under the Gastos segment.
- Editing an expense needs no "recompute" step: settlements are stored payments; balances/transfers are derived at render.

### 4. Settlements / payments (complete)

- Two transfer modes: direct payments and debt minimization (default). Registering a payment (from → to, amount) subtracts from pending transfers.
- Domain: `expense-calculator.ts` (`calculateBalances`, `calculateDirectTransfers`, `minimizeTransfers`) + `settlement-summary.ts` (`buildSettlementSummaryText`: pure text builder; money via `formatMoneyInt`).
- Repo: `settlements-repository.ts` (soft delete like expenses).
- UI: `src/ui/expenses/SettlementForm.tsx` (reusable "quién le paga a quién" form with SearchField) used by `src/app/juntada/pago-nuevo.tsx` (modal `?id=` + optional `?fromId=&toId=&amount=` to prefill from a transfer's "Saldar" button). Summary shared with the native share sheet (`Share.share`) from `[id].tsx`.
- Game results are NOT included in the summary (explicitly out of scope for the share feature; candidate future extension).

### 5. Games / matches (complete)

- Matches per juntada: Truco, Generala, Skull King, FIFA (Liga/Copa), Generic. Live scorer, history, multiple matches per game.
- Domain (pure rules, unit-tested): `src/domain/games/game-types.ts` (`GameId`, `GAME_LABELS`, `Match`, `MatchPlayer`, `TrucoTeam(Size)`) + one folder per game (`truco/`, `generala/`, `skull-king/`, `fifa/`, `generic/`) with scorer + types.
- Repos: shared `matches-repository.ts` (`matches` + `match_players`, HARD delete with cascade — no soft delete for games), one repo per game (`truco-repository.ts`, `generala-repository.ts`, `skull-king-repository.ts`, `fifa-repository.ts`, `generic-repository.ts`).
- UI: setup `src/app/juntada/juego-nuevo.tsx` (modal `?id=` + optional `?game=` preselect; player selection with SearchField), scorer dispatch `src/app/juntada/partida.tsx` (`?match=`; branches on `match.game`), scorer components `src/ui/games/{TrucoScorer,GeneralaScorer,SkullKingScorer,FifaScorer,GenericScorer}.tsx`, match list + delete `src/ui/games/GamesSection.tsx` (rendered by `[id].tsx` under Juegos).
- Rules live ONLY in domain; screens never compute scores (see Supported Games for the actual rules).
- Match players/teams cannot be edited after creation (delete + re-create).

### 6. Search pattern (reusable)

- `src/ui/components/SearchField.tsx` wraps `TextField` with `icon="search"` + `autoCapitalize="none"`.
- Filtering is IN-MEMORY via `matchesQuery(text, query)` from `src/domain/common/text-search.ts` (NFD normalize, strip combining marks, lowercase — case- and accent-insensitive; implemented ASCII-only with `codePointAt`, see Gotchas).
- Filtering never mutates selection state; when the filtered list is empty show `EmptyState` ("No se encontraron personas").
- Already applied in: grupos people list + group member checkboxes, nueva participants, juego-nuevo players, ExpenseForm payer/participants, SettlementForm from/to.

### 7. Theme (complete)

- See Theming section. Light/dark follows the device; no in-app toggle.

## Theming

- `src/ui/theme.tsx` holds the palettes (`lightColors`, `darkColors`), the `spacing`/`radius`/`fontSize` scales, and the theme context.
- `ThemeProvider` (mounted in `src/app/_layout.tsx`, outside the navigation tree) reads the device scheme with `useColorScheme()` and exposes the matching palette through `useColors()` / `useTheme()`.
- Screens and components never import a static palette. The pattern:
  - `const makeStyles = (colors: Colors) => StyleSheet.create({ ... })` at module scope.
  - Inside each component: `const colors = useColors(); const styles = useMemo(() => makeStyles(colors), [colors]);` (or a local `useStyles()` helper when several components share the same styles).
  - Inline color props (e.g. `ActivityIndicator color={colors.primary}`) read from the hook too.
- `StatusBar` uses `style="auto"`; `app.json` sets `userInterfaceStyle: "automatic"`.

## Shared UI Components (reuse before creating new ones)

`src/ui/components/`: `Button` (variants incl. danger), `TextField` (with optional `icon` prop), `Card`, `CheckRow` (checkbox row), `Chip` (selectable, optional `loading`), `EmptyState` (icon + title + description), `Screen` (applies the bottom safe-area inset by default; pass `bottomInset={false}` inside tabs because the tab bar already handles it), `SearchField`, `SectionTitle`.

Android runs edge-to-edge: stack/modal content extends under the system navigation bar. `Screen` adds `insets.bottom` padding so footers and scroll content stay accessible; do not remove it or add manual bottom padding to work around it. Format helpers in `src/ui/format.ts` (delegates to domain money).

## Folder Structure

```
src/app            - Expo Router screens (every file is a route)
  /(tabs)/         - index (juntadas), grupos (people+groups), _layout
  /juntada/        - nueva, [id], gasto-nuevo, gasto-editar, pago-nuevo, juego-nuevo, partida
src/app/AppRoot.tsx - EMPTY vestigial file, not mounted anywhere (safe to ignore/remove)
src/domain         - pure business logic
  /common/         - Money.ts (formatMoneyInt), text-search.ts (normalizeForSearch/matchesQuery)
  /expenses/       - expense-calculator, expense-types, settlement-summary
  /games/          - game-types + truco/ generala/ skull-king/ fifa/ generic/ (each: scorer + types)
  /get-togethers/  - get-together-types
  /groups/         - group-types
  /people/         - person-types
src/infrastructure
  /persistence/    - migrations.ts + repositories: people, groups, get-togethers, expenses,
                     settlements, matches, truco, generala, skull-king, fifa, generic
  /id.ts           - UUID generator
src/ui
  /components/     - Button, Card, CheckRow, Chip, EmptyState, Screen, SearchField, SectionTitle, TextField
  /expenses/       - ExpenseForm, SettlementForm (reusable forms)
  /games/          - GamesSection + one scorer per game
  format.ts        - UI money/date formatting (delegates money to domain)
  theme.tsx        - palettes + scales + ThemeProvider
tests/domain       - unit tests mirroring src/domain (common/, expenses/, games/<game>/)
.github/workflows  - tests.yml (CI)
CONTEXT.md         - this file; README.md - developer overview; diseño.md - original PRD (Spanish)
```

## Domain Model

- Person (id, name, deletedAt, createdAt)
- Group (id, name, memberIds, deletedAt, createdAt)
- GetTogether (id, name, date, status active|closed, closedAt, participantIds snapshot, timestamps)
- Expense (id, getTogetherId, payerId, description, amountInt, participantIds, timestamps, deletedAt)
- Balance (personId, net = paid - owes)
- Transfer (from, to, amount)
- Settlement (id, getTogetherId, fromId, toId, amountInt, timestamps, deletedAt)
- Match (id, getTogetherId, game truco|generala|skull-king|fifa|generic, status active|finished, teamSize for truco, players snapshot with team, timestamps)
- Game-specific: TrucoRound (team1Points, team2Points), GeneralaEntry (box, points, tachado), SkullKingRoundEntry (round, bid, tricks, bonus), FifaGame (round, slot, players, scores, penalty winner), GenericAdjustment (personId, points)

## Data Model (SQLite, migrations v1–v6)

Timestamps are INTEGER epoch milliseconds. Soft deletes via `deleted_at` for money/people data; games are hard-deleted (cascade).

v1 (core):

- people(id, name, deleted_at, created_at)
- groups(id, name, deleted_at, created_at)
- group_members(group_id, person_id, position)
- get_togethers(id, name, date, status, closed_at, created_at, updated_at)
- get_together_people(get_together_id, person_id, position)
- expenses(id, get_together_id, payer_id, description, amount_int, created_at, updated_at, deleted_at)
- expense_participants(expense_id, person_id, position)
- index on expenses(get_together_id)

v2 (games):

- matches(id, get_together_id, game, status, team_size, created_at, finished_at)
- match_players(match_id, person_id, team, position) - player snapshot, team only for truco
- truco_rounds(id, match_id, round_number, winner_team, points, created_at, UNIQUE(match_id, round_number))
- generala_entries(match_id, person_id, box, points, tachado, created_at, PK(match_id, person_id, box))
- skull_king_rounds(match_id, round_number, person_id, bid, tricks, bonus, created_at, PK(match_id, round_number, person_id))

v3 (truco hands store both teams at once):

- truco_rounds rebuilt: id, match_id, round_number, team1_points, team2_points, created_at, UNIQUE(match_id, round_number) — legacy rows migrated from winner_team/points

v4 (generic scorer):

- generic_adjustments(id, match_id, person_id, points, created_at) + index on match_id

v5 (debt settlements):

- settlements(id, get_together_id, from_id, to_id, amount_int, created_at, updated_at, deleted_at)

v6 (FIFA tournaments):

- fifa_tournaments(match_id PK, mode league|cup, created_at)
- fifa_games(id, match_id, round, slot, player1_id, player2_id, score1, score2, penalty_winner_id, played_at, UNIQUE(match_id, round, slot)) + index on match_id
- Nullable players represent cup slots still waiting for a winner; league rounds are appended lazily as the previous one is completed

`position` preserves participant order (it decides who absorbs the split remainder).

## Main Business Rules

- Money stored as integer ARS (no cents)
- Equal split: remainder distributed to the first participants (index 0..r-1)
- Soft delete for people, groups, expenses and settlements (preserve history); games hard-delete
- Editing a group rewrites `group_members` (delete + reinsert with `position`) inside a transaction; soft-deleted members are kept in the group but not offered as options
- Settlements (registered payments) count as paid for the payer and owed by the receiver, so they cancel pending transfers
- Participants snapshot per juntada (history does not break if people change)
- Editing or closing a juntada: NOT implemented yet (open product decision)

## Expense Calculation

All in `src/domain/expenses/expense-calculator.ts`:

- `calculateShares(expense)`: per-participant amount via `splitEvenly`
- `calculateBalances(expenses, settlements)`: net = paid - owes (deleted expenses/settlements ignored; a settlement adds to the payer's paid and the receiver's owed)
- `calculateDirectTransfers(expenses, settlements)`: debtor -> creditor directly against original payers
- `minimizeTransfers(expenses, settlements)`: default mode
- `buildSettlementSummaryText(summary)` in `settlement-summary.ts`: plain-text summary (title + total + one line per transfer, or "todo saldado"); money formatted by `formatMoneyInt` in `domain/common/Money.ts`, the single source of truth behind `ui/format.ts` `formatMoney`

## Debt Minimization Algorithm

Greedy: repeatedly match the largest creditor with the largest debtor until cleared. Produces a financially equivalent result with fewer transfers than the direct mode.

## Supported Games

- Truco: score per team to 30, split display 15 malas + 15 buenas, 1v1/2v2/3v3. Each hand is a single form with one numeric input per team; the hand adds its points to both totals at once. First to reach 30 wins (overshoot allowed).
- Generala: standard Argentine scoring sheet (11 boxes). Upper section 1-6 free entry, +35 bonus when the upper sum is >= 63. Lower boxes use fixed values chosen on entry: escalera 20/25, full 30/35, poker 40/45, generala 50/55, doble generala 100/105. Any box can be tachado (= 0). Sequential turns: the app shows whose turn it is; the current player loads points + box, then the turn passes to the player with the fewest filled boxes (complete sheets are skipped). Game ends when every player filled all 11 boxes.
- Skull King: 10 rounds; round N => N cards, so bids and tricks are capped by the round number. Per player bid + tricks + bonus. Exact bid 0 => +10 * round; exact bid N => 20*N; miss => -10 * |bid - tricks|, except a missed 0 bid which always costs -10 * round. Bonuses only apply when the bid is exact: combat presets (Sirena beats Skull King +40, Pirata beats Sirena +20, Skull King beats Pirata +30, repeatable) plus a free +/- amount field.
- FIFA: tournament for 1v1 matches with manually entered goals. Two modes:
  - Liga (infinite): a round-robin round is generated on demand using the circle method (odd player counts rest one per fecha). When every game in the current fecha is played, the next fecha is appended automatically. Standings: PJ/PG/PE/PP/GF/GC/DIF/PTS, win 3 / draw 1 / loss 0; tie-break by goal difference, then goals for, then participant order. User closes the league manually (or reopens it).
  - Copa: single elimination with automatic byes for non-power-of-two participant counts (standard seed order). Winners advance automatically to the next round; finals crown a champion and finish the match. Ties require a penalty winner.
  - Both modes always surface the next playable game and keep the full match history. `src/domain/games/fifa/fifa-scorer.ts` holds pure rules; `fifa-repository.ts` persists rounds/bracket and advances cup winners.
- Generic: free-form scorekeeper for any other game. Players add integer adjustments (non-zero); totals rank the players (sorted desc, ties share the lead). Used for games without dedicated rules.

## Games Architecture

- Shared types in `src/domain/games/game-types.ts`; labels in `GAME_LABELS` (add new game ids there).
- Pure rules per game in `src/domain/games/<game>/` with unit tests in `tests/domain/games/<game>/`.
- Persistence: `matches` + `match_players` shared, plus one table per game.
- UI: scorer components in `src/ui/games/`, rendered by `src/app/juntada/partida.tsx` (dispatch by `match.game`). Game logic never lives inside screens.

## Navigation

```
(tabs)
├── index   - Juntadas (list + create button)
└── grupos  - Personas y grupos
Stack (root)
├── juntada/nueva        - create juntada (modal)
├── juntada/gasto-nuevo  - add expense (modal, ?id= getTogether)
├── juntada/gasto-editar - edit expense (modal, ?id=, ?expenseId=)
├── juntada/pago-nuevo   - register a debt payment (modal, ?id=, optional ?fromId= ?toId= ?amount=)
├── juntada/juego-nuevo  - start match (modal, ?id=, optional ?game= preselect)
├── juntada/partida      - match scorer/history (?match= matchId)
└── juntada/[id]         - detail with segmented Gastos | Juegos
```

Typed routes are enabled: use template literals (`/juntada/${id}`) or the `router.push({ pathname, params })` object form.

## State Management

- No global store: each screen loads from SQLite on focus.
- Zustand is installed for when real shared client state appears; do not add a store "just in case".

## Persistence

- `expo-sqlite`, database `juntadapp.db`, WAL mode, foreign keys ON (set inside `migrateDatabase`).
- Migrations: `src/infrastructure/persistence/migrations.ts`, versioned with `PRAGMA user_version`.
- To add a migration: append `{ version: N + 1, sql }` to `MIGRATIONS`. Never edit an applied migration. `npm test` does NOT exercise migrations (domain-only tests), so validate SQL carefully (recreate the DB or bump a test device).
- Repositories take the `SQLiteDatabase` as first argument (obtained in screens with `useSQLiteContext()`).

## Testing Strategy

- Unit tests for domain logic only (no component tests in v1), in `tests/domain` mirroring `src/domain`.
- Every new algorithm (splits, balances, game rules, search normalization) must ship with tests.
- Run: `npm test`. Config: `jest.config.js` (jest-expo preset; coverage excludes `src/ui`).
- CI runs typecheck + lint + tests on PRs to master; keep them green.

## Patterns (follow when adding features)

- Reusable forms: extract to `src/ui/<area>/` and receive props (see `ExpenseForm`/`SettlementForm`); screens own loading/saving.
- Edit flows: modal route for editing money records (`gasto-editar`); inline edit state inside the list screen for lightweight entities (people/groups in `grupos.tsx`).
- Destructive actions: always `Alert.alert` confirmation.
- Reload after mutation: call the local `load()` at the end of the mutation (no cache invalidation layer).
- Searchable lists: `SearchField` + `matchesQuery` + local `query` state + `EmptyState` when filtered empty.
- Sharing text: pure builder in domain + `Share.share()` in the screen (never build strings in UI).
- Money: parse inputs to integer with `parseMoneyInput` (Money.ts), display with `formatMoneyInt`; never float arithmetic.

## Important Design Decisions

- Integer money (no cents) per user request
- Soft delete to preserve historical integrity (except games: hard delete)
- Participants snapshot per juntada
- Domain kept separate from UI and persistence
- Expo Router over React Navigation (project instruction in AGENTS.md)
- IDs via `expo-crypto` instead of `uuid`
- Theming via React context + `useColorScheme()` (device-driven); no in-app theme toggle
- Local-first: no backend/sync/login planned

## Known Limitations

- Juntada date is always today (no date picker yet)
- Cannot edit a juntada or its participants (delete + re-create only)
- Cannot close/reopen a juntada; status column exists but is always `active`
- Web not configured or tested
- Match players/teams cannot be edited after creation
- Skull King: only the last saved round can be undone; previous rounds cannot be edited
- Skull King: matches saved before the "one card per round" rule change keep their stored bids; validation applies when saving new rounds
- Truco: no automatic envido/flor/falta tracking, points per hand are entered manually
- Search text normalization is ASCII-combining-marks only (covers Spanish accents; other scripts not normalized)

## Future Features (prioritized)

1. Close/reopen juntadas (status column ready; enables history/read-only mode)
2. Date picker + edit juntada (name/date/participants)
3. Game statistics (wins/rankings — data already persisted; domain-only queries + tests)
4. Unequal splits (percentages / exact amounts; touches expense-calculator + ExpenseForm)
5. Extend WhatsApp summary with expenses detail and/or game results
6. Backup export/import (local-first safety net)

## Development Guidelines

1. Domain first, with tests, before touching UI.
2. Ask before implementing large features or inventing requirements.
3. Prefer simple solutions; avoid overengineering and unnecessary dependencies.
4. Keep UI and business logic separated; TypeScript strict, no unjustified `any`.
5. Code and technical documentation in English; UI text in Spanish.
6. Destructive actions require confirmation (`Alert.alert`).
7. Update this file (and README.md when user-facing) whenever a feature or decision lands.
8. Before declaring a task done: `npm test`, `npm run lint`, `npm run typecheck` (CI runs the same on PRs).

## Git Workflow

- Feature branches off latest `master`, named `feature/<short-name>`.
- Commit messages in Spanish, imperative present ("Agrego...", "Permito...", "Corrijo...").
- PRs target `master`; do not merge, push or close GitHub issues without explicit user confirmation.
- Environment gotcha: creating files with Windows PowerShell `Set-Content` writes a UTF-8 BOM that trips the `unicode-bom` lint rule; write files without BOM.

## How To Add A New Feature

1. Check the Feature Map above: does it extend an existing area? Reuse its patterns/components.
2. Pure logic -> `src/domain/<area>/` + tests in `tests/domain/<area>/`.
3. Persistence -> repository function in `src/infrastructure/persistence/<area>-repository.ts` (db first arg); new tables -> migration v6+ in `migrations.ts`.
4. UI -> extend an existing screen or add a route in `src/app` (Expo Router, modal for create/edit forms); register it in the Navigation section here.
5. Update README.md and this file.

## How To Add A New Game

1. Domain: `src/domain/games/<game>/` with pure rules (scoring, rounds, win condition) + unit tests in `tests/domain/games/<game>/`.
2. Persistence: migration `{ version: N + 1 }` adding a game table (shared `matches`/`match_players` already exist), then a repository with `db` as first argument.
3. UI: scorer component in `src/ui/games/` + dispatch branch in `src/app/juntada/partida.tsx`; keep game logic out of the screen. Add the id to `GameId` + `GAME_LABELS` in `game-types.ts` and to the picker in `juntada/juego-nuevo.tsx`.

## Important Files

- `CONTEXT.md` - this file (AI-facing project context)
- `README.md` - developer-facing overview
- `diseño.md` - original product requirements (Spanish)
- `src/domain/expenses/expense-calculator.ts` - splits, balances, transfers
- `src/domain/common/text-search.ts` - search normalization + matchesQuery
- `src/infrastructure/persistence/migrations.ts` - schema versions v1–v6
- `src/app/_layout.tsx` - root layout (SQLiteProvider + ThemeProvider + Stack)
- `src/app/juntada/[id].tsx` - juntada detail (Liquidación + Gastos | Juegos)
- `src/ui/theme.tsx` - palettes, spacing scale, ThemeProvider + useColors
- `.github/workflows/tests.yml` - CI

## Current Project Status

- Phase 0 setup complete (Expo SDK 57, deps, jest via jest-expo, eslint, CI)
- Expense domain + tests, settlements + debt minimization + share summary
- SQLite schema/migrations v1–v5 + all repositories
- Full UI: juntadas list/create/detail, expenses create/edit/delete, payments, people/groups with inline edit, search everywhere
- Games module: Truco, Generala, Skull King, FIFA (Liga infinita / Copa), Generic (domain + tests + repositories + scorers + match list)
- Light/dark theme follows the device color scheme
- All checks green: `npm test` (96 tests), `npm run lint`, `npm run typecheck`

Next steps (see Future Features): close/reopen juntadas + date picker, then game statistics.

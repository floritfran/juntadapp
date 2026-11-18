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

- Expo SDK 58, React Native 0.88, TypeScript (strict)
- Expo Router (file-based routing, typed routes enabled) - routes in `src/app`
- expo-sqlite (`SQLiteProvider` + `onInit` migration hook), expo-crypto (UUIDs), expo-haptics (selection/light/success feedback), dayjs (dates)
- Jest + jest-expo (`jest.config.js`, transform via babel-preset-expo). Do NOT switch to ts-jest: it was tried and broke on React Native imports; the jest-expo preset is the working setup.
- ESLint with `eslint-config-expo`
- CI: GitHub Actions (`.github/workflows/tests.yml`) runs `npm run typecheck`, `npm run lint`, `npm test` on every push/PR to `master`
- Installed but not used yet: Zustand, zod, react-hook-form (reserved for real shared state / form validation needs; do not add a store or validation lib "just in case"), expo-blur

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
- Active person names are unique (case- and accent-insensitive, trimmed). Creating or renaming to an existing active name is blocked in `grupos.tsx`, juntada creation and the casual game form. A soft-deleted person does not block reusing their name.
- Domain: `src/domain/people/person-types.ts`, `src/domain/people/person-name.ts` (`findPersonWithName` uniqueness helper), `src/domain/groups/group-types.ts`.
- Repos (`src/infrastructure/persistence`):
  - `people-repository.ts`: `createPerson`, `listPeople` (excludes soft-deleted; the options shown in pickers), `listAllPeople` (INCLUDES deleted; used only to display names of historical match players), `updatePerson`, `deletePerson` (soft).
  - `groups-repository.ts`: `createGroup` (group + members in a transaction), `listGroups` (with member names), `updateGroup` (rewrites `group_members` delete+reinsert with `position`; members soft-deleted in the people table are NOT shown as options but ARE kept in the group), `deleteGroup` (soft).
- UI: `src/app/(tabs)/grupos.tsx` — people list (tap pencil to edit inline: an edit form appears at the top of the screen driven by local `editId` state; confirm before discarding edits), groups list with member checkbox picker, both lists filtered by the same `SearchField` query.
- Gotchas: editing a group replaces the full member selection (checkboxes start pre-checked from current members); destructive deletes use `Alert.alert` confirmation.

### 2. Juntadas (create + list + detail + edit + close/reopen)

- Create: name, today's date only, participants (manual multi-select or load from a group, then adjustable).
- List: `src/app/(tabs)/index.tsx` has a `SearchField` (name, accent-insensitive via `matchesQuery`) and a collapsible "Filtros" panel. `MonthPicker` lets you type/arrow to any year and tap one of the 12 months (no need for the month to exist in the data); `clearFilters` resets text, month and participants. Participants use a searchable vertical `FlatList` of `CheckRow`s (all people, AND: only juntadas with every selected participant). Pure logic in `get-together-filters.ts` with domain tests.
- Close/reopen: lock icon in the detail header toggles `status` after an `Alert.alert` confirmation. `closeGetTogether`/`reopenGetTogether` set `status`, `closed_at` and `updated_at` (the hidden casual row is protected). Closed juntadas are read-only: no edit pencil, no new/edit/delete expense, no new/delete payment, no "Saldar"/"Saldar todo", no new/delete match and match rows are not pressable; sharing and deleting the whole juntada still work. Mutation screens guard with `ClosedGetTogether` so deep links/back-stack cannot edit a closed juntada (casual matches are exempt because their hidden get-together is `closed`).
- Edit: name and participants (via the pencil in the detail header); date is still read-only. Reuses the same picker form as create. When participants change and there are expenses, the user chooses whether to rewrite every active expense's participants or apply the change only to new expenses. If any active settlement exists, rewriting existing expenses is blocked (an alert explains the change will only apply to new expenses). Unsaved edits are confirmed before dismissal.
- Only expense PAYERS are locked in the edit picker: their `CheckRow` is disabled (lock icon) and group chips / submit cannot drop them. `findExpensePayers` in `get-together-edits.ts` builds the set from active expenses; `GetTogetherForm` takes it as `lockedParticipantIds` (empty for create). Deleted expenses do not lock anyone. People who only owe a share (expense participants, not payers) can be removed; the edit prompt's "Actualizar gastos" rewrites them out of active expenses so balances/transfers recalculate.
- Domain: `src/domain/get-togethers/get-together-types.ts`, `get-together-edits.ts` (`sameParticipants`, `reassignExpensesToParticipants`), `get-together-filters.ts` (`getMonthKey`, `monthKeyFrom`, `parseMonthKey`, `hasActiveGetTogetherFilters`, `filterGetTogethers`).
- Repo: `get-togethers-repository.ts` (`createGetTogether`, `updateGetTogether` with optional expense participant rewrite in one transaction, `listGetTogethers`, `getGetTogether`, `closeGetTogether`, `reopenGetTogether`, `deleteGetTogether`...). `settlements-repository.ts` exposes `hasSettlements`.
- UI:
   - `src/app/(tabs)/index.tsx` — list: name, date, participant count, total spent, closed badge; search + month/participant filters; create button opens modal.
  - `src/ui/get-togethers/GetTogetherForm.tsx` — shared form for create/edit: group chips, people checkboxes with SearchField, inline new person, dirty reporting; both screens own loading and saving. `useDiscardGuard.ts` uses Expo Router's `usePreventRemove` to confirm discarding edits.
  - `src/app/juntada/nueva.tsx` — create modal wrapper around `GetTogetherForm`.
  - `src/app/juntada/editar.tsx` — edit modal (`?id=`): loads the juntada, people, groups, expense count and payment flag, asks about existing expenses, then saves.
  - `src/app/juntada/[id].tsx` — detail: header with name, participants, edit pencil, delete trash, balances/transfers (Liquidación section: "Saldar" per transfer opens pago-nuevo prefilled, "Saldar todo" registers every pending transfer in one transaction, "Compartir" shares summary text), segmented control Gastos | Juegos. Computes everything at render from expenses + settlements via `expense-calculator` (no stored balances).
- Delete: trash icon in the detail header, `Alert.alert` confirmation (explicitly mentions expenses, payments and games are removed and it cannot be undone). `deleteGetTogether(db, id)` hard-deletes the row and relies on FK `ON DELETE CASCADE` to remove `get_together_people`, expenses + `expense_participants`, settlements and matches with all their game tables. The hidden `casual` row is protected by an `id <>` guard in the same SQL. `router.back()` after success.
- Participants are a SNAPSHOT: later changes to people/groups do not affect existing juntadas (decided). Editing a juntada replaces the whole participant list.
- NOT implemented: date picker (always today). Open product decision.

### 3. Expenses (complete)

- Create/edit/soft delete; equal split; payer + subset of participants.
- Domain: `src/domain/expenses/expense-types.ts` + `expense-calculator.ts` (see Expense Calculation section).
- Repos: `expenses-repository.ts` (`createExpense` + `expense_participants`, `listExpenses`, `updateExpense` which rewrites participants, `deleteExpense` soft).
- UI: `src/ui/expenses/ExpenseForm.tsx` is a REUSABLE form (description, amount, payer chip, participant checkboxes, validation, SearchField) used by both `src/app/juntada/gasto-nuevo.tsx` (modal `?id=`) and `src/app/juntada/gasto-editar.tsx` (modal `?id=&expenseId=`). Expense list + edit/delete actions live in `src/app/juntada/[id].tsx` under the Gastos segment.
- Editing an expense needs no "recompute" step: settlements are stored payments; balances/transfers are derived at render.

### 4. Settlements / payments (complete)

- Two transfer modes: direct payments and debt minimization (default). Registering a payment (from → to, amount) subtracts from pending transfers.
- Domain: `expense-calculator.ts` (`calculateBalances`, `calculateDirectTransfers`, `minimizeTransfers`, `buildSettlementInputs`) + `settlement-summary.ts` (`buildSettlementSummaryText`: pure text builder; money via `formatMoneyInt`).
- Repo: `settlements-repository.ts` (`createSettlements` bulk insert in one transaction, `createSettlement`, soft delete like expenses).
- UI: `src/ui/expenses/SettlementForm.tsx` (reusable "quién le paga a quién" form with SearchField) used by `src/app/juntada/pago-nuevo.tsx` (modal `?id=` + optional `?fromId=&toId=&amount=` to prefill from a transfer's "Saldar" button). "Saldar todo" in `[id].tsx` asks for confirmation with the payment count and total, then inserts every pending transfer at once (button is disabled/loading while saving). Summary shared with the native share sheet (`Share.share`) from `[id].tsx`.
- Game results are NOT included in the summary (explicitly out of scope for the share feature; candidate future extension).

### 5. Games / matches (complete)

- Matches per juntada: Truco, Generala, Skull King, FIFA (Liga/Copa), Generic. Live scorer, history, multiple matches per game.
- Domain (pure rules, unit-tested): `src/domain/games/game-types.ts` (`GameId`, `GAME_LABELS`, `Match`, `MatchPlayer`, `TrucoTeam(Size)`) + one folder per game (`truco/`, `generala/`, `skull-king/`, `fifa/`, `generic/`) with scorer + types.
- Repos: shared `matches-repository.ts` (`matches` + `match_players`, HARD delete with cascade — no soft delete for games), one repo per game (`truco-repository.ts`, `generala-repository.ts`, `skull-king-repository.ts`, `fifa-repository.ts`, `generic-repository.ts`).
- UI: setup `src/app/juntada/juego-nuevo.tsx` (modal `?id=` + optional `?game=` preselect; player selection with SearchField), scorer dispatch `src/app/juntada/partida.tsx` (`?match=`; branches on `match.game`), scorer components `src/ui/games/{TrucoScorer,GeneralaScorer,SkullKingScorer,FifaScorer,GenericScorer}.tsx`, match list + delete `src/ui/games/GamesSection.tsx` (a `FlatList` with `header`/`footer` props, rendered by `[id].tsx` under Juegos and by the casual tab).
- Rules live ONLY in domain; screens never compute scores (see Supported Games for the actual rules).
- Match players/teams cannot be edited after creation (delete + re-create).

### 5b. Casual games / scorekeeper (complete)

- A separate "Juegos" tab for casual scorekeeping: no juntada required. Behavior matches juntada games: a match is finished from the scorer and stays listed until the user deletes it with the trash icon (hard delete).
- All existing games are supported (Truco, Generala, Skull King, FIFA, Generic).
- Player picker behavior differs by flow: from a juntada it lists ONLY that juntada's active participants (soft-deleted people are dropped from the pre-selection, and "Cargar desde un grupo" is hidden); the casual flow lists all active people, keeps groups, and allows creating a new person inline (auto-selected after creation, duplicate names rejected).
- Implementation: a hidden get-together row (`CASUAL_GET_TOGETHER_ID = 'casual'`, migration v8) backs the matches so the existing repositories/scorers are reused unchanged. `listGetTogethers` excludes it.
- UI:
  - `src/app/(tabs)/juegos.tsx` — tab listing casual matches via `GamesSection casual`.
  - `src/app/juegos/nueva.tsx` — create casual match (`NewMatchForm` with `targetGetTogetherId = CASUAL_GET_TOGETHER_ID`).
  - `src/ui/games/NewMatchForm.tsx` — reusable game/players setup extracted from `juntada/juego-nuevo.tsx` (used by both flows). `prefillFromGetTogetherId` marks the juntada flow: participants are pre-selected, the list is filtered to them, and the group chips are hidden. Without it (casual) it shows all people plus an inline "Nueva persona" field.
- `GamesSection` takes `casual?: boolean` only to route its new-match button to `/juegos/nueva`; finishing and deleting work exactly like in a juntada (scorer finish + trash icon).

### 6. Search pattern (reusable)

- `src/ui/components/SearchField.tsx` wraps `TextField` with `icon="search"` + `autoCapitalize="none"` and an X button (`close-circle`) that clears the query when the field has text.
- Filtering is IN-MEMORY via `matchesQuery(text, query)` from `src/domain/common/text-search.ts` (NFD normalize, strip combining marks, lowercase — case- and accent-insensitive; implemented ASCII-only with `codePointAt`, see Gotchas).
- Filtering never mutates selection state; when the filtered list is empty show `EmptyState` ("No se encontraron personas").
- Already applied in: juntadas list, grupos people list + group member checkboxes, nueva participants, juego-nuevo players, ExpenseForm payer/participants, SettlementForm from/to.

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

`src/ui/components/`: `Button` (variants incl. danger), `TextField` (optional `icon` and `onClear` X button), `Card`, `CheckRow` (checkbox row), `Chip` (selectable, optional `loading`), `EmptyState` (icon + title + description), `MonthPicker` (any month/year), `Screen` (safe-area padded container), `SearchField`, `SectionTitle`. `src/ui/get-togethers/ClosedGetTogether.tsx` is the read-only notice used by mutation screens. Format helpers in `src/ui/format.ts` (delegates to domain money).

## Folder Structure

```
src/app            - Expo Router screens (every file is a route)
  /(tabs)/         - index (juntadas), juegos (casual scorekeeper), grupos (people+groups), _layout
  /juntada/        - nueva, editar, [id], gasto-nuevo, gasto-editar, pago-nuevo, juego-nuevo, partida
  /juegos/         - nueva (casual match setup, modal)
src/domain         - pure business logic
  /common/         - Money.ts (formatMoneyInt), text-search.ts (normalizeForSearch/matchesQuery/compareByName)
  /expenses/       - expense-calculator, expense-types, settlement-summary
  /games/          - game-types + truco/ generala/ skull-king/ fifa/ generic/ (each: scorer + types)
   /get-togethers/  - get-together-types, get-together-edits (participant rewrite helpers), get-together-filters (name/month/participants)
  /groups/         - group-types
  /people/         - person-types
src/infrastructure
  /persistence/    - migrations.ts + repositories: people, groups, get-togethers, expenses,
                     settlements, matches, truco, generala, skull-king, fifa, generic
  /id.ts           - UUID generator
src/ui
  /components/     - Button, Card, CheckRow, Chip, EmptyState, MonthPicker, Screen, SearchField, SectionTitle, TextField
  /expenses/       - ExpenseForm, SettlementForm (reusable forms)
   /get-togethers/  - GetTogetherForm (create + edit), useDiscardGuard, ClosedGetTogether
  /games/          - GamesSection + one scorer per game
  format.ts        - UI money/date formatting (delegates money to domain)
  theme.tsx        - palettes + scales + ThemeProvider
tests/domain       - unit tests mirroring src/domain (common/, expenses/, get-togethers/, games/<game>/)
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

## Data Model (SQLite, migrations v1–v8)

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

v7 (FIFA matches per opponent):

- fifa_tournaments.matches_per_opponent INTEGER NULL — `NULL` means infinite league (previous behavior); a positive integer means that many full round-robin cycles before the league auto-finishes

v8 (casual games):

- inserts a hidden `get_togethers` row with id `casual` (`CASUAL_GET_TOGETHER_ID`) used only to attach casual matches; `listGetTogethers` filters it out. No schema changes

`position` preserves participant order (it decides who absorbs the split remainder).

## Main Business Rules

- Money stored as integer ARS (no cents)
- Equal split: remainder distributed to the first participants (index 0..r-1)
- Soft delete for people, groups, expenses and settlements (preserve history); games and whole juntadas hard-delete. Deleting a juntada cascades to all its expenses, settlements and matches (FK `ON DELETE CASCADE`); people/groups survive
- Soft-deleted people never appear as selectable players (pickers use `listPeople`); `listAllPeople` is only for rendering historical match names
- Active person names are unique, compared with `findPersonWithName` (trim + `normalizeForSearch`)
- Editing a group rewrites `group_members` (delete + reinsert with `position`) inside a transaction; soft-deleted members are kept in the group but not offered as options
- Applying a group chip (new juntada or casual match) only selects its active members; soft-deleted members are ignored
- Settlements (registered payments) count as paid for the payer and owed by the receiver, so they cancel pending transfers
- Participants snapshot per juntada (history does not break if people change)
- Editing a juntada rewrites `get_together_people` inside a transaction. With `updateExpenses: true`, every active expense's `expense_participants` is rewritten to the new list, so balances/transfers are derived again at render; the payer of each expense is untouched. With `false`, expenses keep their participant snapshot. Rewriting existing expenses is unavailable once the juntada has an active settlement.
- A person who paid an active expense cannot be removed from the juntada; the edit form disables their checkbox and keeps them selected even when a group chip is applied. A person who only owes a share can be removed; rewriting existing expenses drops their share and recalculates balances.
- Closing a juntada sets `status = 'closed'` and `closed_at = now`; reopening clears `closed_at` and restores `active`. Both bump `updated_at`, are confirmed in the UI and never touch the hidden casual row. A closed juntada is read-only; the hidden casual row is always `closed` but casual scorekeeping stays editable (guards exempt `CASUAL_GET_TOGETHER_ID`).
- Casual matches belong to the hidden `casual` get-together; they finish and delete like any other match (no special discard flow)

## Expense Calculation

All in `src/domain/expenses/expense-calculator.ts`:

- `calculateShares(expense)`: per-participant amount via `splitEvenly`
- `calculateBalances(expenses, settlements)`: net = paid - owes (deleted expenses/settlements ignored; a settlement adds to the payer's paid and the receiver's owed)
- `calculateDirectTransfers(expenses, settlements)`: debtor -> creditor directly against original payers
- `minimizeTransfers(expenses, settlements)`: default mode
- `buildSettlementInputs(transfers)`: maps the pending transfers to settlement rows for the bulk "Saldar todo" action
- `buildSettlementSummaryText(summary)` in `settlement-summary.ts`: plain-text summary (title + total + one line per transfer, or "todo saldado"); money formatted by `formatMoneyInt` in `domain/common/Money.ts`, the single source of truth behind `ui/format.ts` `formatMoney`

## Juntada participant changes

- `reassignExpensesToParticipants(expenses, participantIds)` in `src/domain/get-togethers/get-together-edits.ts` replaces the participant snapshot of every active expense; deleted expenses are ignored and original expense objects are not mutated.
- `updateGetTogether(db, id, { name, participantIds, updateExpenses })` rewrites `get_together_people` and, when requested, each active expense's `expense_participants` in one transaction (also bumping `expenses.updated_at`). Payers are never changed.
- Balances and transfers are never stored: the detail screen recomputes them from expenses + settlements after the edit. Tests in `tests/domain/get-togethers/get-together-edits.test.ts` cover balances and transfers for added/removed participants.
- The edit UI asks whether to rewrite existing expenses only when participants changed and there are expenses. If `hasSettlements(db, id)` is true, that option is unavailable because registered payments would no longer match the recalculated balances.
- `findExpensePayers(expenses)` returns the `Set<PersonId>` of payers across active expenses; `editar.tsx` passes it to `GetTogetherForm.lockedParticipantIds` so payers cannot be unchecked. Submit also re-checks the set defensively. Debtors are not locked: removing one plus `updateExpenses: true` updates balances/transfers, already covered by the "recalculates balances when a participant is removed" test.

## Debt Minimization Algorithm

Greedy: repeatedly match the largest creditor with the largest debtor until cleared. Produces a financially equivalent result with fewer transfers than the direct mode.

## Supported Games

- Truco: score per team to 30, split display 15 malas + 15 buenas, 1v1/2v2/3v3. Each hand is a single form with one numeric input per team; the hand adds its points to both totals at once. First to reach 30 wins (overshoot allowed).
- Generala: standard Argentine scoring sheet (11 boxes). Upper section 1-6 free entry, +35 bonus when the upper sum is >= 63. Lower boxes use fixed values chosen on entry: escalera 20/25, full 30/35, poker 40/45, generala 50/55, doble generala 100/105. Any box can be tachado (= 0). Sequential turns: the app shows whose turn it is; the current player loads points + box, then the turn passes to the player with the fewest filled boxes (complete sheets are skipped). Game ends when every player filled all 11 boxes.
- Skull King: 10 rounds; round N => N cards, so bids and tricks are capped by the round number. Per player bid + tricks + bonus. Exact bid 0 => +10 * round; exact bid N => 20*N; miss => -10 * |bid - tricks|, except a missed 0 bid which always costs -10 * round. Bonuses only apply when the bid is exact: combat presets (Sirena beats Skull King +40, Pirata beats Sirena +20, Skull King beats Pirata +30, repeatable) plus a free +/- amount field.
- FIFA: tournament for 1v1 matches with manually entered goals. Two modes:
  - Liga: a round-robin round is generated on demand using the circle method (odd player counts rest one per fecha). "Partidos contra cada equipo" is configurable at creation: `null` = infinite (default, rounds keep being appended until the user closes the league), or a positive integer k = fixed schedule of k full round-robin cycles; when the last fecha is played the league finishes automatically. Standings: PJ/PG/PE/PP/GF/GC/DIF/PTS, win 3 / draw 1 / loss 0; tie-break by goal difference, then goals for, then participant order.
  - Copa: single elimination with automatic byes for non-power-of-two participant counts (standard seed order). Winners advance automatically to the next round; finals crown a champion and finish the match. Ties require a penalty winner.
  - Both modes always surface the next playable game and keep the full match history. The last saved result can be undone: goals are cleared and, in Copa, the winner is removed from the next bracket slot when that slot has not been played yet. Undoing a finished match reopens it. `src/domain/games/fifa/fifa-scorer.ts` holds pure rules; `fifa-repository.ts` persists rounds/bracket and advances cup winners.
- Generic: free-form scorekeeper for any other game. Players add integer adjustments (non-zero); totals rank the players (sorted desc, ties share the lead). Used for games without dedicated rules.

## Games Architecture

- Shared types in `src/domain/games/game-types.ts`; labels in `GAME_LABELS` (add new game ids there).
- Pure rules per game in `src/domain/games/<game>/` with unit tests in `tests/domain/games/<game>/`.
- Persistence: `matches` + `match_players` shared, plus one table per game.
- UI: scorer components in `src/ui/games/`, rendered by `src/app/juntada/partida.tsx` (dispatch by `match.game`). Game logic never lives inside screens.
- Haptics: all scorers call `src/ui/haptics.ts` (`selectionHaptic`, `lightHaptic`, `successHaptic`) on submit/undo/status changes/finish; the helper swallows unsupported-device errors. Only fire the finish haptic once per completion (check whether the action actually finished the match).

## Navigation

```
(tabs)
├── index   - Juntadas (list + create button)
├── juegos  - Casual scorekeeper (in-progress matches + new match)
└── grupos  - Personas y grupos
Stack (root)
├── juntada/nueva        - create juntada (modal)
├── juntada/editar       - edit juntada name/participants (modal, ?id=)
├── juegos/nueva         - create casual match (modal, hidden casual get-together)
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
- Migrations: `src/infrastructure/persistence/migrations.ts`, versioned with `PRAGMA user_version`. Repository-level cascade behavior is tested against a real in-memory `node:sqlite` DB in `tests/infrastructure/persistence/get-togethers-repository.test.ts`.
- To add a migration: append `{ version: N + 1, sql }` to `MIGRATIONS`. Never edit an applied migration. `tests/infrastructure/persistence/migrations.test.ts` runs the real migrations against an in-memory `node:sqlite` database (fresh DB, incremental upgrade and idempotency), so extend it when adding a migration.
- Repositories take the `SQLiteDatabase` as first argument (obtained in screens with `useSQLiteContext()`).

## Testing Strategy

- Unit tests for domain logic in `tests/domain` mirroring `src/domain`, plus infrastructure tests (migrations) in `tests/infrastructure`. No component tests in v1.
- Every new algorithm (splits, balances, game rules, search normalization) must ship with tests.
- Run: `npm test`. Config: `jest.config.js` (jest-expo preset; coverage excludes `src/ui`).
- CI runs typecheck + lint + tests on PRs to master; keep them green.

## Patterns (follow when adding features)

- Reusable forms: extract to `src/ui/<area>/` and receive props (see `ExpenseForm`/`SettlementForm`/`NewMatchForm`); screens own loading/saving.
- Edit flows: modal route for editing money records (`gasto-editar`) and juntadas (`editar`); inline edit state inside the list screen for lightweight entities (people/groups in `grupos.tsx`). Modal forms that can be dirtied report it through `onDirtyChange` and use `useDiscardGuard` (Expo Router `usePreventRemove`) to confirm dismissal; once the save succeeds, clear `dirty` and call the guard's `disable` before `router.back()` so navigation is not blocked.
- Destructive actions: always `Alert.alert` confirmation.
- Reload after mutation: call the local `load()` at the end of the mutation (no cache invalidation layer).
- Searchable lists: `SearchField` + `matchesQuery` + local `query` state + `EmptyState` when filtered empty.
- Long lists and form pickers: use `FlatList`/`SectionList` (`ListHeaderComponent` for titles/fields/search, `renderItem` for rows, `ListFooterComponent` for counters/extra controls) instead of `ScrollView` + `.map`; short forms may keep `ScrollView` but people pickers inside them use horizontal `FlatList`s. Use `keyboardShouldPersistTaps="handled"` and `keyboardDismissMode="on-drag"`.
- Sharing text: pure builder in domain + `Share.share()` in the screen (never build strings in UI).
- Money: parse inputs to integer with `parseMoneyInput` (Money.ts), display with `formatMoneyInt`; never float arithmetic.
- Numeric inputs: `TextField` with an explicit numeric `keyboardType` (`number-pad` for non-negative values; iOS `numbers-and-punctuation` / Android `numeric` when signed values are allowed). Text inputs keep the default letters keyboard.

## Important Design Decisions

- Integer money (no cents) per user request
- Soft delete to preserve historical integrity (except games: hard delete)
- Participants snapshot per juntada
- Domain kept separate from UI and persistence
- Expo Router over React Navigation (project instruction in AGENTS.md)
- IDs via `expo-crypto` instead of `uuid`
- Theming via React context + `useColorScheme()` (device-driven); no in-app theme toggle
- Local-first: no backend/sync/login planned
- People/groups are ordered in JS with `compareByName` (accent-insensitive) because SQLite `COLLATE NOCASE` only folds ASCII
- Haptic feedback is a thin, fail-safe wrapper (`src/ui/haptics.ts`) instead of direct `expo-haptics` calls in components
- Long lists are virtualized (`FlatList`/`SectionList`) to keep large people/game/expense lists responsive

## Known Limitations

- Juntada date is always today (no date picker yet)
- Cannot edit a juntada's date (always today; the detail screen shows the stored date read-only)
- Juntada filters by date are month/year-based (any month can be picked; no arbitrary day range yet)
- Web not configured or tested
- Match players/teams cannot be edited after creation
- Skull King: only the last saved round can be undone; previous rounds cannot be edited
- Skull King: matches saved before the "one card per round" rule change keep their stored bids; validation applies when saving new rounds
- Truco: no automatic envido/flor/falta tracking, points per hand are entered manually
- Search text normalization is ASCII-combining-marks only (covers Spanish accents; other scripts not normalized)

## Future Features (prioritized)

1. Date picker for juntadas (edit name/participants is already implemented)
2. Game statistics (wins/rankings — data already persisted; domain-only queries + tests)
3. Unequal splits (percentages / exact amounts; touches expense-calculator + ExpenseForm)
4. Extend WhatsApp summary with expenses detail and/or game results
5. Backup export/import (local-first safety net)

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
- `src/ui/get-togethers/GetTogetherForm.tsx` - shared create/edit form for juntada name + participants
- `src/domain/get-togethers/get-together-edits.ts` - participant rewrite + change detection helpers
- `src/domain/get-togethers/get-together-filters.ts` - name/month/participant filters for the juntadas list
- `src/ui/get-togethers/ClosedGetTogether.tsx` - read-only notice for closed juntadas
- `diseño.md` - original product requirements (Spanish)
- `src/domain/expenses/expense-calculator.ts` - splits, balances, transfers
- `src/domain/common/text-search.ts` - search normalization + matchesQuery
- `src/infrastructure/persistence/migrations.ts` - schema versions v1–v8 + `CASUAL_GET_TOGETHER_ID`
- `src/ui/games/NewMatchForm.tsx` - reusable match setup (juntada + casual flows)
- `src/app/_layout.tsx` - root layout (SQLiteProvider + ThemeProvider + Stack)
- `src/app/juntada/[id].tsx` - juntada detail (Liquidación + Gastos | Juegos, edit + delete header)
- `src/ui/theme.tsx` - palettes, spacing scale, ThemeProvider + useColors
- `.github/workflows/tests.yml` - CI

## Current Project Status

- Phase 0 setup complete (Expo SDK 58, deps, jest via jest-expo, eslint, CI)
- Expense domain + tests, settlements + debt minimization + share summary + "Saldar todo" bulk payments
- SQLite schema/migrations v1–v5 + all repositories
- Full UI: juntadas list/create/edit/detail, expenses create/edit/delete, payments, people/groups with inline edit, search everywhere
- Games module: Truco, Generala, Skull King, FIFA (Liga infinita / Copa), Generic (domain + tests + repositories + scorers + match list)
- Casual games tab: play any game without a juntada; finish like juntadas and delete with the trash icon
- Light/dark theme follows the device color scheme
- All checks green: `npm test` (145 tests), `npm run lint`, `npm run typecheck`

- Juntada edit: name + participants, prompts to rewrite existing expenses (blocked once a payment is registered), discard confirmation, domain tests for balance recalculation
- Only expense payers are locked in the participant picker; debtors can be removed and a domain test covers the balance recalculation
- Juntada delete cascades to expenses, payments and every game table (infrastructure test in `tests/infrastructure/persistence/get-togethers-repository.test.ts`)
- Close/reopen juntadas with status/closed_at repository functions, read-only detail screen and guards on every mutation screen; infrastructure tests cover the hidden casual row
- Juntadas list search (name) + filters by any month/year and searchable participant list, with pure domain helpers and tests

Next steps (see Future Features): date picker, then game statistics.

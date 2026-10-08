# JuntadApp

Mobile app to organize meetups (juntadas): split expenses and keep track of board/card game scores. Offline-first, local persistence, built for fast use during the meetup itself.

## Stack

- Expo SDK 57 (React Native, TypeScript strict)
- Expo Router (file-based navigation, typed routes)
- expo-sqlite (local database with versioned migrations)
- expo-crypto (UUIDs), dayjs (dates)
- Jest + ts-jest (domain unit tests), ESLint (`eslint-config-expo`)

## Features (so far)

- People and friend groups management
- Create a juntada with participants (manual or from a saved group)
- Record expenses: payer, amount, participants
- Equal split with deterministic integer remainder
- Settlement: direct payments or debt minimization (default)
- Juntadas list with date, participants and total spent
- SQLite persistence with migrations
- Games module (per juntada, multiple matches per game, live scorer + stored history):
  - Truco: team score to 30 (15 malas + 15 buenas), 1v1/2v2/3v3 with team assignment, one form with a points input per team per hand, undo last hand
  - Generala: one play per player (the turn passes to the next player after each entry), standard Argentine sheet (upper bonus 35 at 63+, fixed lower values), tachar any box, editable entries
  - Skull King: 10 rounds of one card per player each (round N deals N cards), bid + tricks per player, automatic scoring (exact bid 0 = 10 x round, exact bid N = 20 x N, miss = -10 per unit), combat bonus presets and free +/- bonuses, round history with undo

## Requirements

- Node 20+, npm
- Expo Go (iOS/Android) or an emulator

## Install and run

```bash
npm install
npm start          # dev server; scan the QR code with Expo Go
npm run android
npm run ios
```

## Scripts

| Script                  | Description                     |
| ----------------------- | ------------------------------- |
| `npm start`             | Start the Expo dev server       |
| `npm run android`/`ios` | Run on Android/iOS              |
| `npm test`              | Domain unit tests               |
| `npm run typecheck`     | TypeScript check (`--noEmit`)   |
| `npm run lint`          | ESLint over the whole project   |

Run `npm test`, `npm run lint` and `npm run typecheck` before finishing any task.

## Project structure

```
src/app            - Expo Router screens (every file is a route)
src/domain         - pure business logic, unit tested, no RN/Expo imports
src/infrastructure - SQLite migrations + repositories, id generator
src/ui             - theme, formatters, shared components
tests/domain       - domain unit tests
```

Architecture: `UI (src/app) -> repositories (src/infrastructure/persistence) -> domain (src/domain)`.

## Conventions

- Money in integer ARS (no cents)
- Code and technical docs in English; UI text in Spanish
- Business logic lives in `src/domain` with tests, never inside components
- Soft deletes preserve historical data
- Read `CONTEXT.md` before starting work; keep it updated when decisions change

## Adding a new game

See `CONTEXT.md` → "How To Add A New Game": pure rules in `src/domain/games/<game>/` + tests, then a scorer UI inside the Juegos tab of the juntada detail.

import { PersonId } from '../game-types';
import {
  FifaCupResultPlan,
  FifaGame,
  FifaGamePlan,
  FifaResult,
  FifaStandingRow,
} from './fifa-types';

export const FIFA_POINTS = {
  win: 3,
  draw: 1,
  loss: 0,
} as const;

export function validateFifaScore(score: number): void {
  if (!Number.isInteger(score) || score < 0) {
    throw new Error('score must be a non-negative integer');
  }
}

export function validateFifaScores(result: FifaResult): void {
  validateFifaScore(result.score1);
  validateFifaScore(result.score2);
}

export function validateFifaResult(
  result: FifaResult,
  player1Id: PersonId,
  player2Id: PersonId
): void {
  validateFifaScores(result);
  if (result.score1 === result.score2) {
    if (
      !result.penaltyWinnerId ||
      (result.penaltyWinnerId !== player1Id && result.penaltyWinnerId !== player2Id)
    ) {
      throw new Error('tied games require a penalty winner');
    }
  }
}

export function fifaGameWinner(game: FifaGame): PersonId | null {
  if (!game.player1Id || !game.player2Id) return null;
  if (game.score1 === null || game.score2 === null) return null;
  if (game.score1 > game.score2) return game.player1Id;
  if (game.score2 > game.score1) return game.player2Id;
  return game.penaltyWinnerId;
}

export function leagueRoundPlan(
  playerIds: readonly PersonId[],
  roundIndex: number
): FifaGamePlan[] {
  if (playerIds.length < 2) {
    throw new Error('league needs at least two players');
  }
  if (!Number.isInteger(roundIndex) || roundIndex < 0) {
    throw new Error('round index must be a non-negative integer');
  }
  const list: (PersonId | null)[] = [...playerIds];
  if (list.length % 2 === 1) {
    list.push(null);
  }
  const rotation = roundIndex % (list.length - 1);
  const fixed = list[0];
  const rest = list.slice(1);
  const rotated = rest.map((_, index) => rest[(index - rotation + rest.length) % rest.length]);
  const ordered: (PersonId | null)[] = [fixed, ...rotated];
  const games: FifaGamePlan[] = [];
  for (let slot = 0; slot < ordered.length / 2; slot++) {
    const player1Id = ordered[slot];
    const player2Id = ordered[ordered.length - 1 - slot];
    if (player1Id && player2Id) {
      games.push({ round: roundIndex, slot, player1Id, player2Id });
    }
  }
  return games;
}

export function validateMatchesPerOpponent(value: number | null): void {
  if (value === null) return;
  if (!Number.isInteger(value) || value < 1) {
    throw new Error('matches per opponent must be a positive integer or null');
  }
}

export function leagueTotalRounds(
  playerCount: number,
  matchesPerOpponent: number | null
): number | null {
  if (matchesPerOpponent === null) return null;
  if (playerCount < 2) return null;
  const paddedCount = playerCount % 2 === 0 ? playerCount : playerCount + 1;
  return (paddedCount - 1) * matchesPerOpponent;
}

export function isLeagueComplete(
  games: readonly FifaGame[],
  playerCount: number,
  matchesPerOpponent: number | null
): boolean {
  const totalRounds = leagueTotalRounds(playerCount, matchesPerOpponent);
  if (totalRounds === null || games.length === 0) return false;
  const lastRound = Math.max(...games.map((game) => game.round));
  if (lastRound < totalRounds - 1) return false;
  return games.every((game) => game.score1 !== null && game.score2 !== null);
}

export function nextLeagueRoundIndex(games: readonly FifaGame[]): number {
  if (games.length === 0) return 0;
  return Math.max(...games.map((game) => game.round)) + 1;
}

export function nextPlayableGame(games: readonly FifaGame[]): FifaGame | null {
  const pending = games
    .filter(
      (game) =>
        game.player1Id !== null &&
        game.player2Id !== null &&
        game.score1 === null &&
        game.score2 === null
    )
    .sort((a, b) => a.round - b.round || a.slot - b.slot);
  return pending[0] ?? null;
}

export function leagueStandings(
  playerIds: readonly PersonId[],
  games: readonly FifaGame[]
): FifaStandingRow[] {
  const rows = new Map<PersonId, FifaStandingRow>();
  playerIds.forEach((personId) =>
    rows.set(personId, {
      personId,
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDifference: 0,
      points: 0,
    })
  );

  for (const game of games) {
    if (!game.player1Id || !game.player2Id) continue;
    if (game.score1 === null || game.score2 === null) continue;
    const player1 = rows.get(game.player1Id);
    const player2 = rows.get(game.player2Id);
    if (!player1 || !player2) continue;

    player1.played += 1;
    player2.played += 1;
    player1.goalsFor += game.score1;
    player1.goalsAgainst += game.score2;
    player2.goalsFor += game.score2;
    player2.goalsAgainst += game.score1;

    if (game.score1 > game.score2) {
      player1.won += 1;
      player2.lost += 1;
      player1.points += FIFA_POINTS.win;
      player2.points += FIFA_POINTS.loss;
    } else if (game.score2 > game.score1) {
      player2.won += 1;
      player1.lost += 1;
      player2.points += FIFA_POINTS.win;
      player1.points += FIFA_POINTS.loss;
    } else {
      player1.drawn += 1;
      player2.drawn += 1;
      player1.points += FIFA_POINTS.draw;
      player2.points += FIFA_POINTS.draw;
    }
  }

  const positionById = new Map(playerIds.map((personId, index) => [personId, index]));
  return [...rows.values()]
    .map((row) => ({ ...row, goalDifference: row.goalsFor - row.goalsAgainst }))
    .sort(
      (a, b) =>
        b.points - a.points ||
        b.goalDifference - a.goalDifference ||
        b.goalsFor - a.goalsFor ||
        (positionById.get(a.personId) ?? 0) - (positionById.get(b.personId) ?? 0)
    );
}

function bracketSize(playerCount: number): number {
  let size = 1;
  while (size < playerCount) size *= 2;
  return size;
}

function seedOrder(size: number): number[] {
  let order = [1, 2];
  while (order.length < size) {
    const sum = order.length * 2 + 1;
    order = order.flatMap((seed) => [seed, sum - seed]);
  }
  return order;
}

export function cupBracketPlan(playerIds: readonly PersonId[]): FifaGamePlan[] {
  if (playerIds.length < 2) {
    throw new Error('cup needs at least two players');
  }
  const size = bracketSize(playerIds.length);
  const seeds = seedOrder(size);
  const seedsToPlayers: (PersonId | null)[] = seeds.map(
    (seed) => playerIds[seed - 1] ?? null
  );

  const games: FifaGamePlan[] = [];
  let current = seedsToPlayers;
  let round = 0;
  while (current.length > 1) {
    const next: (PersonId | null)[] = new Array(current.length / 2).fill(null);
    for (let slot = 0; slot < current.length / 2; slot++) {
      const player1Id = current[slot * 2];
      const player2Id = current[slot * 2 + 1];
      if (player1Id && player2Id) {
        games.push({ round, slot, player1Id, player2Id });
      } else if (round === 0) {
        if (player1Id || player2Id) {
          next[slot] = player1Id ?? player2Id;
        }
      } else {
        games.push({
          round,
          slot,
          player1Id: player1Id ?? null,
          player2Id: player2Id ?? null,
        });
      }
    }
    current = next;
    round += 1;
  }
  return games;
}

export function applyCupResult(
  games: readonly FifaGame[],
  gameId: string,
  result: FifaResult
): FifaCupResultPlan {
  const target = games.find((game) => game.id === gameId);
  if (!target) throw new Error('game not found');
  if (!target.player1Id || !target.player2Id) {
    throw new Error('game players are not defined yet');
  }
  if (target.score1 !== null || target.score2 !== null) {
    throw new Error('game already has a result');
  }
  validateFifaResult(result, target.player1Id, target.player2Id);

  const winnerId =
    result.score1 > result.score2
      ? target.player1Id
      : result.score2 > result.score1
        ? target.player2Id
        : (result.penaltyWinnerId as PersonId);

  const updated = games.map((game) =>
    game.id === gameId
      ? {
          ...game,
          score1: result.score1,
          score2: result.score2,
          penaltyWinnerId: result.penaltyWinnerId ?? null,
          playedAt: new Date(),
        }
      : game
  );

  const nextRound = target.round + 1;
  const nextSlot = Math.floor(target.slot / 2);
  const nextIndex = updated.findIndex(
    (game) => game.round === nextRound && game.slot === nextSlot
  );

  if (nextIndex === -1) {
    return { games: updated, winnerId, championId: winnerId };
  }

  const nextGame = updated[nextIndex];
  updated[nextIndex] =
    target.slot % 2 === 0
      ? { ...nextGame, player1Id: winnerId }
      : { ...nextGame, player2Id: winnerId };

  return { games: updated, winnerId, championId: null };
}

export function cupChampion(games: readonly FifaGame[]): PersonId | null {
  if (games.length === 0) return null;
  const lastRound = Math.max(...games.map((game) => game.round));
  const final = games.find((game) => game.round === lastRound);
  return final ? fifaGameWinner(final) : null;
}

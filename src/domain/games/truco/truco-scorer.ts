import { TrucoTeamSize } from '../game-types';
import { TrucoPlayer, TrucoRound, TrucoScore, TrucoTeam, TRUCO_HALF_SCORE, TRUCO_TARGET_SCORE } from './truco-types';

export function validateTrucoTeamSetup(players: readonly TrucoPlayer[], teamSize: TrucoTeamSize): void {
  if (players.length !== teamSize * 2) {
    throw new Error(`truco ${teamSize}v${teamSize} requires ${teamSize * 2} players`);
  }
  const team1 = players.filter((player) => player.team === 1).length;
  const team2 = players.filter((player) => player.team === 2).length;
  if (team1 !== teamSize || team2 !== teamSize) {
    throw new Error(`each team must have exactly ${teamSize} players`);
  }
}

export function initialTrucoScore(): TrucoScore {
  return { team1: 0, team2: 0 };
}

export function addTrucoRound(
  score: TrucoScore,
  team1Points: number,
  team2Points: number
): TrucoScore {
  if (!Number.isInteger(team1Points) || team1Points < 0) {
    throw new Error('team1 points must be a non negative integer');
  }
  if (!Number.isInteger(team2Points) || team2Points < 0) {
    throw new Error('team2 points must be a non negative integer');
  }
  if (team1Points + team2Points < 1) {
    throw new Error('a hand must award at least one point');
  }
  return { team1: score.team1 + team1Points, team2: score.team2 + team2Points };
}

export function trucoWinner(score: TrucoScore): TrucoTeam | null {
  if (score.team1 >= TRUCO_TARGET_SCORE) return 1;
  if (score.team2 >= TRUCO_TARGET_SCORE) return 2;
  return null;
}

export function isTrucoFinished(score: TrucoScore): boolean {
  return trucoWinner(score) !== null;
}

export interface TrucoHalves {
  malas: number;
  buenas: number;
}

export function trucoHalves(points: number): TrucoHalves {
  const clamped = Math.max(0, points);
  return {
    malas: Math.min(clamped, TRUCO_HALF_SCORE),
    buenas: Math.max(0, clamped - TRUCO_HALF_SCORE),
  };
}

export function nextTrucoRoundNumber(rounds: readonly TrucoRound[]): number {
  return rounds.length + 1;
}

export function computeTrucoScore(rounds: readonly TrucoRound[]): TrucoScore {
  return rounds.reduce(
    (score, round) => addTrucoRound(score, round.team1Points, round.team2Points),
    initialTrucoScore()
  );
}

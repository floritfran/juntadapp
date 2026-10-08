import {
  addTrucoRound,
  computeTrucoScore,
  initialTrucoScore,
  isTrucoFinished,
  nextTrucoRoundNumber,
  trucoHalves,
  trucoWinner,
} from '../../../../src/domain/games/truco/truco-scorer';
import { TrucoRound } from '../../../../src/domain/games/truco/truco-types';

describe('truco - marcador a 30', () => {
  test('starts at zero', () => {
    expect(initialTrucoScore()).toEqual({ team1: 0, team2: 0 });
  });

  test('adds each team points from a single hand', () => {
    const s1 = addTrucoRound(initialTrucoScore(), 2, 0);
    const s2 = addTrucoRound(s1, 0, 3);
    const s3 = addTrucoRound(s2, 1, 1);
    expect(s3).toEqual({ team1: 3, team2: 4 });
  });

  test('rejects negative or fractional points', () => {
    expect(() => addTrucoRound(initialTrucoScore(), -2, 1)).toThrow();
    expect(() => addTrucoRound(initialTrucoScore(), 1, -2)).toThrow();
    expect(() => addTrucoRound(initialTrucoScore(), 1.5, 0)).toThrow();
    expect(() => addTrucoRound(initialTrucoScore(), 0, 2.5)).toThrow();
  });

  test('rejects a hand where no team scores', () => {
    expect(() => addTrucoRound(initialTrucoScore(), 0, 0)).toThrow();
  });

  test('team reaching 30 wins', () => {
    let score = initialTrucoScore();
    score = addTrucoRound(score, 0, 30);
    expect(trucoWinner(score)).toBe(2);
    expect(isTrucoFinished(score)).toBe(true);
  });

  test('overshooting 30 still wins', () => {
    let score = initialTrucoScore();
    score = addTrucoRound(score, 28, 0);
    score = addTrucoRound(score, 3, 0);
    expect(score.team1).toBe(31);
    expect(trucoWinner(score)).toBe(1);
  });

  test('no winner below 30', () => {
    let score = initialTrucoScore();
    score = addTrucoRound(score, 15, 0);
    score = addTrucoRound(score, 0, 14);
    expect(trucoWinner(score)).toBeNull();
    expect(isTrucoFinished(score)).toBe(false);
  });
});

describe('truco - buenas y malas', () => {
  test('points up to 15 are all malas', () => {
    expect(trucoHalves(0)).toEqual({ malas: 0, buenas: 0 });
    expect(trucoHalves(15)).toEqual({ malas: 15, buenas: 0 });
  });

  test('past 15 malas stay full and buenas grow', () => {
    expect(trucoHalves(16)).toEqual({ malas: 15, buenas: 1 });
    expect(trucoHalves(23)).toEqual({ malas: 15, buenas: 8 });
    expect(trucoHalves(30)).toEqual({ malas: 15, buenas: 15 });
  });

  test('negative input is clamped to zero', () => {
    expect(trucoHalves(-5)).toEqual({ malas: 0, buenas: 0 });
  });
});

describe('truco - historial de rondas', () => {
  test('recomputes the score from rounds', () => {
    const rounds: TrucoRound[] = [
      { roundNumber: 1, team1Points: 2, team2Points: 0 },
      { roundNumber: 2, team1Points: 0, team2Points: 3 },
      { roundNumber: 3, team1Points: 1, team2Points: 1 },
    ];
    expect(computeTrucoScore(rounds)).toEqual({ team1: 3, team2: 4 });
    expect(nextTrucoRoundNumber(rounds)).toBe(4);
  });
});

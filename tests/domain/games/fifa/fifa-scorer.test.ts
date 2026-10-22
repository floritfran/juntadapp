import {
  applyCupResult,
  cupBracketPlan,
  cupChampion,
  fifaGameWinner,
  isLeagueComplete,
  leagueRoundPlan,
  leagueStandings,
  leagueTotalRounds,
  nextLeagueRoundIndex,
  nextPlayableGame,
  validateFifaResult,
  validateFifaScore,
  validateFifaScores,
  validateMatchesPerOpponent,
} from '../../../../src/domain/games/fifa/fifa-scorer';
import {
  FifaGame,
  FifaGamePlan,
  FifaResult,
} from '../../../../src/domain/games/fifa/fifa-types';

function game(
  id: string,
  plan: FifaGamePlan,
  result: FifaResult | null = null
): FifaGame {
  return {
    id,
    round: plan.round,
    slot: plan.slot,
    player1Id: plan.player1Id,
    player2Id: plan.player2Id,
    score1: result?.score1 ?? null,
    score2: result?.score2 ?? null,
    penaltyWinnerId: result?.penaltyWinnerId ?? null,
    playedAt: result ? new Date(0) : null,
  };
}

function toGames(plans: FifaGamePlan[]): FifaGame[] {
  return plans.map((plan, index) => game(`g${index}`, plan));
}

describe('fifa - validación de resultados', () => {
  test('acepta goles enteros no negativos', () => {
    expect(() => validateFifaScore(0)).not.toThrow();
    expect(() => validateFifaScore(3)).not.toThrow();
  });

  test('rechaza goles negativos o fraccionarios', () => {
    expect(() => validateFifaScore(-1)).toThrow();
    expect(() => validateFifaScore(1.5)).toThrow();
    expect(() => validateFifaScore(Number.NaN)).toThrow();
  });

  test('un empate exige ganador por penales entre los dos jugadores', () => {
    expect(() =>
      validateFifaResult({ score1: 1, score2: 1 }, 'a', 'b')
    ).toThrow();
    expect(() =>
      validateFifaResult({ score1: 1, score2: 1, penaltyWinnerId: 'c' }, 'a', 'b')
    ).toThrow();
    expect(() =>
      validateFifaResult({ score1: 1, score2: 1, penaltyWinnerId: 'a' }, 'a', 'b')
    ).not.toThrow();
  });

  test('un resultado con ganador no necesita penales', () => {
    expect(() =>
      validateFifaResult({ score1: 2, score2: 0 }, 'a', 'b')
    ).not.toThrow();
  });

  test('la liga permite empates sin penales', () => {
    expect(() => validateFifaScores({ score1: 1, score2: 1 })).not.toThrow();
    expect(() => validateFifaScores({ score1: -1, score2: 1 })).toThrow();
  });
});

describe('fifa - liga infinita', () => {
  test('con 2 jugadores se enfrentan en cada fecha', () => {
    expect(leagueRoundPlan(['a', 'b'], 0)).toEqual([
      { round: 0, slot: 0, player1Id: 'a', player2Id: 'b' },
    ]);
  });

  test('con 3 jugadores cada fecha tiene un partido y uno descansa', () => {
    const rounds = [0, 1, 2].map((round) => leagueRoundPlan(['a', 'b', 'c'], round));
    rounds.forEach((round) => expect(round).toHaveLength(1));
    const pairs = rounds
      .map((round) => [round[0].player1Id, round[0].player2Id].sort().join('-'))
      .sort();
    expect(pairs).toEqual(['a-b', 'a-c', 'b-c']);
  });

  test('con 4 jugadores cada fecha tiene dos partidos sin repetir parejas', () => {
    const rounds = [0, 1, 2].map((round) => leagueRoundPlan(['a', 'b', 'c', 'd'], round));
    rounds.forEach((round) => expect(round).toHaveLength(2));
    const pairs = rounds
      .flat()
      .map((plan) => [plan.player1Id, plan.player2Id].sort().join('-'))
      .sort();
    expect(pairs).toEqual(['a-b', 'a-c', 'a-d', 'b-c', 'b-d', 'c-d']);
  });

  test('la liga infinita sigue rotando después de completar la ronda', () => {
    expect(nextLeagueRoundIndex([])).toBe(0);
    const games = toGames([
      { round: 0, slot: 0, player1Id: 'a', player2Id: 'b' },
      { round: 0, slot: 1, player1Id: 'c', player2Id: 'd' },
    ]);
    expect(nextLeagueRoundIndex(games)).toBe(1);
    expect(leagueRoundPlan(['a', 'b', 'c', 'd'], 3)).toHaveLength(2);
  });

  test('el próximo partido es el primero pendiente con ambos jugadores', () => {
    const games: FifaGame[] = [
      game('g0', { round: 1, slot: 0, player1Id: 'c', player2Id: 'd' }),
      game('g1', { round: 0, slot: 1, player1Id: 'a', player2Id: 'b' }),
      game('g2', { round: 0, slot: 0, player1Id: 'c', player2Id: 'd' }, {
        score1: 2,
        score2: 1,
      }),
    ];
    expect(nextPlayableGame(games)?.id).toBe('g1');
    expect(nextPlayableGame([])).toBeNull();
  });
});

describe('fifa - limite de partidos contra cada equipo', () => {
  test('calcula las fechas totales por cantidad de jugadores y vueltas', () => {
    expect(leagueTotalRounds(3, 1)).toBe(3);
    expect(leagueTotalRounds(3, 2)).toBe(6);
    expect(leagueTotalRounds(4, 1)).toBe(3);
    expect(leagueTotalRounds(4, 2)).toBe(6);
    expect(leagueTotalRounds(2, 5)).toBe(5);
    expect(leagueTotalRounds(6, 1)).toBe(5);
  });

  test('sin limite devuelve null', () => {
    expect(leagueTotalRounds(4, null)).toBeNull();
    expect(leagueTotalRounds(1, 2)).toBeNull();
  });

  test('valida la cantidad configurada', () => {
    expect(() => validateMatchesPerOpponent(null)).not.toThrow();
    expect(() => validateMatchesPerOpponent(1)).not.toThrow();
    expect(() => validateMatchesPerOpponent(3)).not.toThrow();
    expect(() => validateMatchesPerOpponent(0)).toThrow();
    expect(() => validateMatchesPerOpponent(-1)).toThrow();
    expect(() => validateMatchesPerOpponent(1.5)).toThrow();
  });

  test('con 2 vueltas cada pareja se enfrenta dos veces', () => {
    const plans = Array.from({ length: 6 }, (_, round) =>
      leagueRoundPlan(['a', 'b', 'c'], round)
    ).flat();
    const counts = new Map<string, number>();
    plans.forEach((plan) => {
      const key = [plan.player1Id, plan.player2Id].sort().join('-');
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    expect([...counts.values()]).toEqual([2, 2, 2]);
  });

  test('la liga con limite termina al jugar todas las fechas', () => {
    const plans = Array.from({ length: 6 }, (_, round) =>
      leagueRoundPlan(['a', 'b', 'c'], round)
    ).flat();
    const played = plans.map((plan, index) =>
      game(`g${index}`, plan, { score1: 1, score2: 0 })
    );
    expect(isLeagueComplete(played, 3, 2)).toBe(true);
    expect(isLeagueComplete(played, 3, null)).toBe(false);

    const pending = played.map((item, index) =>
      index === played.length - 1 ? { ...item, score1: null, score2: null } : item
    );
    expect(isLeagueComplete(pending, 3, 2)).toBe(false);

    const partial = played.filter((item) => item.round < 5);
    expect(isLeagueComplete(partial, 3, 2)).toBe(false);
  });
});

describe('fifa - tabla de posiciones', () => {
  test('acumula PJ, PG, PE, PP, goles y puntos', () => {
    const games: FifaGame[] = [
      game('g0', { round: 0, slot: 0, player1Id: 'a', player2Id: 'b' }, {
        score1: 3,
        score2: 1,
      }),
      game('g1', { round: 0, slot: 1, player1Id: 'a', player2Id: 'c' }, {
        score1: 0,
        score2: 0,
      }),
      game('g2', { round: 1, slot: 0, player1Id: 'b', player2Id: 'c' }, {
        score1: 2,
        score2: 2,
      }),
    ];

    expect(leagueStandings(['a', 'b', 'c'], games)).toEqual([
      {
        personId: 'a',
        played: 2,
        won: 1,
        drawn: 1,
        lost: 0,
        goalsFor: 3,
        goalsAgainst: 1,
        goalDifference: 2,
        points: 4,
      },
      {
        personId: 'c',
        played: 2,
        won: 0,
        drawn: 2,
        lost: 0,
        goalsFor: 2,
        goalsAgainst: 2,
        goalDifference: 0,
        points: 2,
      },
      {
        personId: 'b',
        played: 2,
        won: 0,
        drawn: 1,
        lost: 1,
        goalsFor: 3,
        goalsAgainst: 5,
        goalDifference: -2,
        points: 1,
      },
    ]);
  });

  test('ignora partidos pendientes y jugadores desconocidos', () => {
    const games: FifaGame[] = [
      game('g0', { round: 1, slot: 0, player1Id: 'a', player2Id: 'b' }),
      game('g1', { round: 0, slot: 0, player1Id: 'a', player2Id: 'b' }, {
        score1: 1,
        score2: 0,
      }),
    ];
    const rows = leagueStandings(['a', 'b'], games);
    expect(rows.map((row) => row.played)).toEqual([1, 1]);
  });

  test('desempata por diferencia de gol y luego goles a favor', () => {
    const games: FifaGame[] = [
      game('g0', { round: 0, slot: 0, player1Id: 'a', player2Id: 'c' }, {
        score1: 2,
        score2: 0,
      }),
      game('g1', { round: 0, slot: 1, player1Id: 'b', player2Id: 'd' }, {
        score1: 4,
        score2: 1,
      }),
    ];
    const rows = leagueStandings(['a', 'b', 'c', 'd'], games);
    expect(rows.map((row) => row.personId)).toEqual(['b', 'a', 'c', 'd']);
  });
});

describe('fifa - copa', () => {
  test('con 2 jugadores se juega directamente la final', () => {
    const plans = cupBracketPlan(['a', 'b']);
    expect(plans).toEqual([
      { round: 0, slot: 0, player1Id: 'a', player2Id: 'b' },
    ]);
  });

  test('con 4 jugadores arma semifinales y final', () => {
    const plans = cupBracketPlan(['a', 'b', 'c', 'd']);
    expect(plans.filter((plan) => plan.round === 0)).toHaveLength(2);
    expect(plans.filter((plan) => plan.round === 1)).toEqual([
      { round: 1, slot: 0, player1Id: null, player2Id: null },
    ]);
  });

  test('con 3 jugadores el primero pasa directo a la final', () => {
    const plans = cupBracketPlan(['a', 'b', 'c']);
    expect(plans).toEqual([
      { round: 0, slot: 1, player1Id: 'b', player2Id: 'c' },
      { round: 1, slot: 0, player1Id: 'a', player2Id: null },
    ]);
  });

  test('con 5 jugadores reparte byes sin pisarse', () => {
    const plans = cupBracketPlan(['a', 'b', 'c', 'd', 'e']);
    const roundOne = plans.filter((plan) => plan.round === 1);
    expect(roundOne).toHaveLength(2);
    const players = roundOne
      .flatMap((plan) => [plan.player1Id, plan.player2Id])
      .filter((personId): personId is string => personId !== null)
      .sort();
    expect(players).toEqual(['a', 'b', 'c']);
    expect(plans.filter((plan) => plan.round === 2)).toEqual([
      { round: 2, slot: 0, player1Id: null, player2Id: null },
    ]);
  });

  test('el ganador avanza a la siguiente ronda y se corona al campeón', () => {
    const games = toGames(cupBracketPlan(['a', 'b', 'c', 'd']));
    const semi1 = games.find((item) => item.round === 0 && item.slot === 0)!;
    const semi2 = games.find((item) => item.round === 0 && item.slot === 1)!;

    const afterSemi1 = applyCupResult(games, semi1.id, { score1: 2, score2: 1 });
    expect(afterSemi1.championId).toBeNull();
    const finalAfterSemi1 = afterSemi1.games.find((item) => item.round === 1)!;
    expect(finalAfterSemi1.player1Id).toBe(semi1.player1Id);

    const afterSemi2 = applyCupResult(afterSemi1.games, semi2.id, {
      score1: 0,
      score2: 1,
    });
    const finalAfterSemi2 = afterSemi2.games.find((item) => item.round === 1)!;
    expect(finalAfterSemi2.player2Id).toBe(semi2.player2Id);

    const final = afterSemi2.games.find((item) => item.round === 1)!;
    const afterFinal = applyCupResult(afterSemi2.games, final.id, {
      score1: 1,
      score2: 1,
      penaltyWinnerId: final.player1Id,
    });
    expect(afterFinal.championId).toBe(final.player1Id);
    expect(cupChampion(afterFinal.games)).toBe(final.player1Id);
  });

  test('con 3 jugadores el bye espera al ganador de la otra llave', () => {
    const games = toGames(cupBracketPlan(['a', 'b', 'c']));
    const semi = games.find((item) => item.round === 0)!;
    const afterSemi = applyCupResult(games, semi.id, { score1: 3, score2: 0 });
    const final = afterSemi.games.find((item) => item.round === 1)!;
    expect(final.player1Id).toBe('a');
    expect(final.player2Id).toBe(semi.player1Id);
  });

  test('no permite cargar dos veces el mismo partido', () => {
    const games = toGames(cupBracketPlan(['a', 'b']));
    const afterFirst = applyCupResult(games, games[0].id, { score1: 1, score2: 0 });
    expect(() =>
      applyCupResult(afterFirst.games, games[0].id, { score1: 2, score2: 0 })
    ).toThrow();
  });

  test('no permite jugar una llave sin ambos jugadores definidos', () => {
    const games = toGames(cupBracketPlan(['a', 'b', 'c', 'd']));
    const final = games.find((item) => item.round === 1)!;
    expect(() =>
      applyCupResult(games, final.id, { score1: 1, score2: 0 })
    ).toThrow();
  });

  test('reconoce al ganador de un partido con penales', () => {
    const played = game('g0', { round: 0, slot: 0, player1Id: 'a', player2Id: 'b' }, {
      score1: 1,
      score2: 1,
      penaltyWinnerId: 'b',
    });
    expect(fifaGameWinner(played)).toBe('b');
  });
});

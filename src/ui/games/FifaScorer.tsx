import { useCallback, useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import { Match, MatchStatus, PersonId } from '@/domain/games/game-types';
import { FIFA_MODE_LABELS, FifaMode, FifaResult } from '@/domain/games/fifa/fifa-types';
import {
  applyCupResult,
  cupChampion,
  fifaGameWinner,
  isLeagueComplete,
  leagueStandings,
  leagueTotalRounds,
  nextLeagueRoundIndex,
  nextPlayableGame,
  validateFifaResult,
  validateFifaScores,
} from '@/domain/games/fifa/fifa-scorer';
import {
  appendFifaLeagueRound,
  FifaTournament,
  getFifaTournament,
  saveFifaResult,
} from '@/infrastructure/persistence/fifa-repository';
import { finishMatch, reopenMatch } from '@/infrastructure/persistence/matches-repository';
import { Button } from '@/ui/components/Button';
import { Card } from '@/ui/components/Card';
import { Chip } from '@/ui/components/Chip';
import { SectionTitle } from '@/ui/components/SectionTitle';
import { TextField } from '@/ui/components/TextField';
import { fontSize, spacing, useColors, type Colors } from '@/ui/theme';

interface Props {
  match: Match;
  nameOf: (personId: PersonId) => string;
  onStatusChange?: (status: MatchStatus) => void;
}

function parseScore(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === '') return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function roundLabel(
  round: number,
  totalRounds: number,
  mode: FifaMode,
  leagueTotal: number | null = null
): string {
  if (mode === 'league') {
    return leagueTotal === null ? `Fecha ${round + 1}` : `Fecha ${round + 1}/${leagueTotal}`;
  }
  const remaining = totalRounds - 1 - round;
  if (remaining === 0) return 'Final';
  if (remaining === 1) return 'Semifinales';
  if (remaining === 2) return 'Cuartos de final';
  return `Ronda ${round + 1}`;
}

export function FifaScorer({ match, nameOf, onStatusChange }: Props) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const db = useSQLiteContext();
  const playerIds = useMemo(() => match.players.map((player) => player.personId), [match.players]);
  const [tournament, setTournament] = useState<FifaTournament | null>(null);
  const [status, setStatus] = useState<MatchStatus>(match.status);
  const [score1Input, setScore1Input] = useState('');
  const [score2Input, setScore2Input] = useState('');
  const [penaltyWinnerId, setPenaltyWinnerId] = useState<PersonId | null>(null);
  const [saving, setSaving] = useState(false);

  const changeStatus = useCallback(
    (next: MatchStatus) => {
      setStatus(next);
      onStatusChange?.(next);
    },
    [onStatusChange]
  );

  const load = useCallback(async () => {
    setTournament(await getFifaTournament(db, match.id));
  }, [db, match.id]);

  useFocusEffect(
    useCallback(() => {
      load().catch(() => setTournament(null));
    }, [load])
  );

  if (!tournament) return null;

  const mode = tournament.mode;
  const games = tournament.games;
  const nextGame = nextPlayableGame(games);
  const champion = mode === 'cup' ? cupChampion(games) : null;
  const standings = mode === 'league' ? leagueStandings(playerIds, games) : [];
  const playedGames = games
    .filter((game) => game.score1 !== null && game.score2 !== null)
    .sort((a, b) => b.round - a.round || b.slot - a.slot);
  const totalRounds = games.length > 0 ? Math.max(...games.map((game) => game.round)) + 1 : 0;
  const leagueTotal =
    mode === 'league'
      ? leagueTotalRounds(playerIds.length, tournament.matchesPerOpponent)
      : null;
  const leagueComplete =
    mode === 'league' &&
    isLeagueComplete(games, playerIds.length, tournament.matchesPerOpponent);

  const parsedScore1 = parseScore(score1Input);
  const parsedScore2 = parseScore(score2Input);
  const isTie =
    mode === 'cup' &&
    parsedScore1 !== null &&
    parsedScore2 !== null &&
    parsedScore1 === parsedScore2;

  const submit = async () => {
    if (!nextGame || !nextGame.player1Id || !nextGame.player2Id) return;
    if (parsedScore1 === null || parsedScore2 === null) {
      Alert.alert('Resultado incompleto', 'Ingresá los goles de ambos jugadores.');
      return;
    }
    const result: FifaResult = {
      score1: parsedScore1,
      score2: parsedScore2,
      penaltyWinnerId: isTie ? penaltyWinnerId : null,
    };
    try {
      if (mode === 'cup') {
        validateFifaResult(result, nextGame.player1Id, nextGame.player2Id);
      } else {
        validateFifaScores(result);
      }
    } catch {
      Alert.alert(
        'Resultado inválido',
        mode === 'cup'
          ? 'Los goles deben ser enteros no negativos y los empates se definen por penales.'
          : 'Los goles deben ser enteros no negativos.'
      );
      return;
    }

    setSaving(true);
    try {
      if (mode === 'league') {
        await saveFifaResult(db, { matchId: match.id, gameId: nextGame.id, result });
        const refreshed = await getFifaTournament(db, match.id);
        if (refreshed && !nextPlayableGame(refreshed.games)) {
          const nextRound = nextLeagueRoundIndex(refreshed.games);
          const total = leagueTotalRounds(playerIds.length, refreshed.matchesPerOpponent);
          if (total !== null && nextRound >= total) {
            await finishMatch(db, match.id);
            changeStatus('finished');
          } else {
            await appendFifaLeagueRound(db, {
              matchId: match.id,
              playerIds,
              roundIndex: nextRound,
            });
          }
        }
      } else {
        const plan = applyCupResult(games, nextGame.id, result);
        await saveFifaResult(db, {
          matchId: match.id,
          gameId: nextGame.id,
          result,
          advance: plan.championId
            ? null
            : {
                round: nextGame.round + 1,
                slot: Math.floor(nextGame.slot / 2),
                position: nextGame.slot % 2 === 0 ? 1 : 2,
                winnerId: plan.winnerId,
              },
        });
        if (plan.championId) {
          await finishMatch(db, match.id);
          changeStatus('finished');
        }
      }
      setScore1Input('');
      setScore2Input('');
      setPenaltyWinnerId(null);
      await load();
    } catch {
      Alert.alert('Error', 'No se pudo guardar el resultado.');
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = () => {
    if (status === 'finished') {
      reopenMatch(db, match.id).then(() => changeStatus('active')).catch(() => undefined);
      return;
    }
    Alert.alert('Finalizar liga', '¿Cerrar la liga con la tabla actual?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Finalizar',
        onPress: async () => {
          await finishMatch(db, match.id);
          changeStatus('finished');
        },
      },
    ]);
  };

  const canPlay =
    status === 'active' && nextGame !== null && champion === null && !leagueComplete;

  return (
    <View>
      {champion ? (
        <View style={styles.winnerBanner}>
          <Text style={styles.winnerText}>Campeón: {nameOf(champion)}</Text>
        </View>
      ) : null}

      {!champion && (status === 'finished' || leagueComplete) ? (
        <View style={styles.finishedBanner}>
          <Text style={styles.finishedText}>Liga finalizada</Text>
        </View>
      ) : null}

      {canPlay && nextGame ? (
        <>
          <SectionTitle title="Próximo partido" />
          <Card style={styles.nextCard}>
            <Text style={styles.nextRound}>
              {FIFA_MODE_LABELS[mode]}
              {mode === 'league'
                ? ` · ${
                    tournament.matchesPerOpponent === null
                      ? 'Sin límite'
                      : `${tournament.matchesPerOpponent} vs c/u`
                  }`
                : ''}
              {' · '}
              {roundLabel(nextGame.round, totalRounds, mode, leagueTotal)}
            </Text>
            <View style={styles.scoreRow}>
              <View style={styles.flex}>
                <Text numberOfLines={1} style={styles.playerName}>
                  {nameOf(nextGame.player1Id as PersonId)}
                </Text>
                <TextField
                  keyboardType="number-pad"
                  label="Goles"
                  onChangeText={setScore1Input}
                  placeholder="0"
                  value={score1Input}
                />
              </View>
              <Text style={styles.scoreDash}>-</Text>
              <View style={styles.flex}>
                <Text numberOfLines={1} style={styles.playerName}>
                  {nameOf(nextGame.player2Id as PersonId)}
                </Text>
                <TextField
                  keyboardType="number-pad"
                  label="Goles"
                  onChangeText={setScore2Input}
                  placeholder="0"
                  value={score2Input}
                />
              </View>
            </View>
            {isTie ? (
              <>
                <Text style={styles.penaltyLabel}>Empate: ¿quién gana por penales?</Text>
                <View style={styles.chipsRow}>
                  <Chip
                    label={nameOf(nextGame.player1Id as PersonId)}
                    onPress={() => setPenaltyWinnerId(nextGame.player1Id)}
                    selected={penaltyWinnerId === nextGame.player1Id}
                  />
                  <Chip
                    label={nameOf(nextGame.player2Id as PersonId)}
                    onPress={() => setPenaltyWinnerId(nextGame.player2Id)}
                    selected={penaltyWinnerId === nextGame.player2Id}
                  />
                </View>
              </>
            ) : null}
            <Button loading={saving} onPress={submit} style={styles.saveButton} title="Guardar resultado" />
          </Card>
        </>
      ) : null}

      {mode === 'league' ? (
        <>
          <SectionTitle style={styles.section} title="Tabla de posiciones" />
          <Card style={styles.tableCard}>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderCell, styles.positionCell]}>#</Text>
              <Text style={[styles.tableHeaderCell, styles.nameCell]}>Jugador</Text>
              <Text style={styles.tableHeaderCell}>PJ</Text>
              <Text style={styles.tableHeaderCell}>PG</Text>
              <Text style={styles.tableHeaderCell}>PE</Text>
              <Text style={styles.tableHeaderCell}>PP</Text>
              <Text style={styles.tableHeaderCell}>GF</Text>
              <Text style={styles.tableHeaderCell}>GC</Text>
              <Text style={styles.tableHeaderCell}>DIF</Text>
              <Text style={[styles.tableHeaderCell, styles.pointsCell]}>PTS</Text>
            </View>
            {standings.map((row, index) => (
              <View key={row.personId} style={styles.tableRow}>
                <Text style={[styles.tableCell, styles.positionCell]}>{index + 1}</Text>
                <Text numberOfLines={1} style={[styles.tableCell, styles.nameCell]}>
                  {nameOf(row.personId)}
                </Text>
                <Text style={styles.tableCell}>{row.played}</Text>
                <Text style={styles.tableCell}>{row.won}</Text>
                <Text style={styles.tableCell}>{row.drawn}</Text>
                <Text style={styles.tableCell}>{row.lost}</Text>
                <Text style={styles.tableCell}>{row.goalsFor}</Text>
                <Text style={styles.tableCell}>{row.goalsAgainst}</Text>
                <Text style={styles.tableCell}>{row.goalDifference}</Text>
                <Text style={[styles.tableCell, styles.pointsCell]}>{row.points}</Text>
              </View>
            ))}
          </Card>

          {leagueComplete && status === 'finished' ? null : (
            <Button
              onPress={toggleStatus}
              style={styles.statusButton}
              title={status === 'finished' ? 'Reabrir liga' : 'Finalizar liga'}
              variant="secondary"
            />
          )}
        </>
      ) : null}

      {mode === 'cup' && totalRounds > 0 ? (
        <>
          <SectionTitle style={styles.section} title="Cuadro" />
          {Array.from({ length: totalRounds }, (_, round) => (
            <View key={round} style={styles.roundBlock}>
              <Text style={styles.roundTitle}>{roundLabel(round, totalRounds, mode)}</Text>
              {games
                .filter((game) => game.round === round)
                .map((game) => {
                  const isNext = nextGame?.id === game.id;
                  const winnerId = fifaGameWinner(game);
                  return (
                    <View
                      key={game.id}
                      style={[styles.bracketGame, isNext ? styles.bracketGameNext : null]}
                    >
                      <Text
                        numberOfLines={1}
                        style={[styles.bracketName, winnerId === game.player1Id ? styles.bracketWinner : null]}
                      >
                        {game.player1Id ? nameOf(game.player1Id) : 'Por definir'}
                      </Text>
                      <Text style={styles.bracketScore}>
                        {game.score1 !== null && game.score2 !== null
                          ? `${game.score1} - ${game.score2}${game.penaltyWinnerId ? ' (pen)' : ''}`
                          : 'vs'}
                      </Text>
                      <Text
                        numberOfLines={1}
                        style={[styles.bracketName, winnerId === game.player2Id ? styles.bracketWinner : null]}
                      >
                        {game.player2Id ? nameOf(game.player2Id) : 'Por definir'}
                      </Text>
                    </View>
                  );
                })}
            </View>
          ))}
        </>
      ) : null}

      <SectionTitle style={styles.section} title="Historial de partidos" />
      {playedGames.length === 0 ? (
        <Text style={styles.emptyHistory}>Todavía no hay partidos jugados.</Text>
      ) : (
        playedGames.map((game) => (
          <View key={game.id} style={styles.historyRow}>
            <Text style={styles.historyRound}>
              {roundLabel(game.round, totalRounds, mode, leagueTotal)}
            </Text>
            <Text numberOfLines={1} style={[styles.historyResult, styles.flex]}>
              {game.player1Id ? nameOf(game.player1Id) : '?'} {game.score1} - {game.score2}{' '}
              {game.player2Id ? nameOf(game.player2Id) : '?'}
              {game.penaltyWinnerId ? ` · Pen: ${nameOf(game.penaltyWinnerId)}` : ''}
            </Text>
          </View>
        ))
      )}
    </View>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  winnerBanner: {
    backgroundColor: colors.success,
    borderRadius: 12,
    padding: spacing.md,
  },
  winnerText: {
    color: colors.onPrimary,
    fontSize: fontSize.lg,
    fontWeight: '700',
    textAlign: 'center',
  },
  finishedBanner: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 12,
    padding: spacing.md,
  },
  finishedText: {
    color: colors.textMuted,
    fontSize: fontSize.md,
    fontWeight: '700',
    textAlign: 'center',
  },
  nextCard: {
    marginTop: spacing.sm,
    padding: spacing.md,
  },
  nextRound: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    fontWeight: '600',
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
  },
  scoreRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  scoreDash: {
    color: colors.textMuted,
    fontSize: fontSize.xl,
    fontWeight: '700',
    marginTop: spacing.lg,
  },
  playerName: {
    color: colors.text,
    fontSize: fontSize.md,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  penaltyLabel: {
    color: colors.text,
    fontSize: fontSize.md,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  saveButton: {
    marginTop: spacing.md,
  },
  section: {
    marginTop: spacing.xl,
  },
  tableCard: {
    padding: spacing.sm,
  },
  tableHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    paddingBottom: spacing.xs,
  },
  tableHeaderCell: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
    width: 24,
  },
  tableRow: {
    alignItems: 'center',
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: 'row',
    minHeight: 34,
  },
  tableCell: {
    color: colors.text,
    fontSize: fontSize.sm,
    textAlign: 'center',
    width: 24,
  },
  positionCell: {
    width: 18,
  },
  nameCell: {
    flex: 1,
    minWidth: 72,
    textAlign: 'left',
  },
  pointsCell: {
    fontWeight: '800',
    width: 30,
  },
  statusButton: {
    marginTop: spacing.md,
  },
  roundBlock: {
    marginBottom: spacing.md,
  },
  roundTitle: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    fontWeight: '700',
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
  },
  bracketGame: {
    alignItems: 'center',
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: spacing.sm,
    borderWidth: 1,
    flexDirection: 'row',
    marginBottom: spacing.xs,
    minHeight: 40,
    paddingHorizontal: spacing.sm,
  },
  bracketGameNext: {
    borderColor: colors.primary,
    borderWidth: 2,
  },
  bracketName: {
    color: colors.textMuted,
    flex: 1,
    fontSize: fontSize.sm,
  },
  bracketWinner: {
    color: colors.text,
    fontWeight: '700',
  },
  bracketScore: {
    color: colors.text,
    fontSize: fontSize.sm,
    fontWeight: '700',
    marginHorizontal: spacing.sm,
  },
  emptyHistory: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
  },
  historyRow: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    minHeight: 36,
  },
  historyRound: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    width: 92,
  },
  historyResult: {
    color: colors.text,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  flex: {
    flex: 1,
  },
});

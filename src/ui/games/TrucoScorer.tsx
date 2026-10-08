import { Ionicons } from '@expo/vector-icons';
import { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import { Match, MatchStatus, TrucoTeam } from '@/domain/games/game-types';
import {
  addTrucoRound,
  computeTrucoScore,
  trucoHalves,
  trucoWinner,
} from '@/domain/games/truco/truco-scorer';
import { TrucoRound, TRUCO_TARGET_SCORE } from '@/domain/games/truco/truco-types';
import { finishMatch, reopenMatch } from '@/infrastructure/persistence/matches-repository';
import { addTrucoRound as insertTrucoRound, listTrucoRounds, removeLastTrucoRound } from '@/infrastructure/persistence/truco-repository';
import { Button } from '@/ui/components/Button';
import { Card } from '@/ui/components/Card';
import { SectionTitle } from '@/ui/components/SectionTitle';
import { TextField } from '@/ui/components/TextField';
import { colors, fontSize, spacing } from '@/ui/theme';

interface Props {
  match: Match;
  nameOf: (personId: string) => string;
  onStatusChange?: (status: MatchStatus) => void;
}

function teamLabel(team: TrucoTeam): string {
  return team === 1 ? 'Equipo A' : 'Equipo B';
}

function handLabel(round: TrucoRound): string {
  const parts: string[] = [];
  if (round.team1Points > 0) parts.push(`${teamLabel(1)} +${round.team1Points}`);
  if (round.team2Points > 0) parts.push(`${teamLabel(2)} +${round.team2Points}`);
  return parts.join(' · ');
}

function parsePoints(text: string): number {
  const trimmed = text.trim();
  return trimmed === '' ? 0 : Number(trimmed);
}

export function TrucoScorer({ match, nameOf, onStatusChange }: Props) {
  const db = useSQLiteContext();
  const [rounds, setRounds] = useState<TrucoRound[] | null>(null);
  const [status, setStatus] = useState(match.status);
  const changeStatus = (next: MatchStatus) => {
    setStatus(next);
    onStatusChange?.(next);
  };
  const [team1Text, setTeam1Text] = useState('');
  const [team2Text, setTeam2Text] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const result = await listTrucoRounds(db, match.id);
    setRounds(result);
  }, [db, match.id]);

  useFocusEffect(
    useCallback(() => {
      load().catch(() => setRounds([]));
    }, [load])
  );

  if (rounds === null) return null;

  const score = computeTrucoScore(rounds);
  const winner = trucoWinner(score);
  const finished = winner !== null || status === 'finished';
  const team1 = match.players.filter((player) => player.team === 1);
  const team2 = match.players.filter((player) => player.team === 2);

  const syncFinished = async (nextFinished: boolean) => {
    if (nextFinished && status !== 'finished') {
      await finishMatch(db, match.id);
      changeStatus('finished');
    } else if (!nextFinished && status === 'finished') {
      await reopenMatch(db, match.id);
      changeStatus('active');
    }
  };

  const submit = async () => {
    const team1Points = parsePoints(team1Text);
    const team2Points = parsePoints(team2Text);
    if (
      !Number.isInteger(team1Points) ||
      team1Points < 0 ||
      !Number.isInteger(team2Points) ||
      team2Points < 0 ||
      team1Points + team2Points < 1
    ) {
      Alert.alert('Puntos inválidos', 'Cargá los puntos de cada equipo. Al menos uno debe ser mayor a cero.');
      return;
    }
    setSaving(true);
    try {
      const updated = addTrucoRound(score, team1Points, team2Points);
      await insertTrucoRound(db, { matchId: match.id, team1Points, team2Points });
      setRounds(await listTrucoRounds(db, match.id));
      setTeam1Text('');
      setTeam2Text('');
      await syncFinished(trucoWinner(updated) !== null);
    } catch {
      Alert.alert('Error', 'No se pudo cargar la mano.');
    }
    setSaving(false);
  };

  const undoLast = () => {
    const last = rounds[rounds.length - 1];
    if (!last) return;
    Alert.alert('Deshacer mano', `¿Eliminar la mano ${last.roundNumber} (${handLabel(last)})?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          await removeLastTrucoRound(db, match.id);
          setRounds(await listTrucoRounds(db, match.id));
          await syncFinished(false);
        },
      },
    ]);
  };

  const toggleStatus = () => {
    if (status === 'finished') {
      reopenMatch(db, match.id).then(() => changeStatus('active'));
    } else {
      Alert.alert('Finalizar partida', '¿Cerrar la partida ahora?', [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Finalizar',
          onPress: async () => {
            await finishMatch(db, match.id);
            changeStatus('finished');
          },
        },
      ]);
    }
  };

  const scoreColumn = (team: TrucoTeam) => {
    const total = team === 1 ? score.team1 : score.team2;
    const halves = trucoHalves(total);
    const isWinner = winner === team;
    return (
      <View key={team} style={[styles.scoreColumn, isWinner && styles.scoreColumnWinner]}>
        <Text style={styles.teamTitle}>{teamLabel(team)}</Text>
        <Text style={styles.teamTotal}>{total}</Text>
        <Text style={styles.teamHalves}>
          Malas {halves.malas} · Buenas {halves.buenas}
        </Text>
        <Text numberOfLines={2} style={styles.teamPlayers}>
          {(team === 1 ? team1 : team2).map((player) => nameOf(player.personId)).join(', ')}
        </Text>
      </View>
    );
  };

  return (
    <View>
      <Card style={styles.scoreboard}>
        {scoreColumn(1)}
        <View style={styles.scoreDivider} />
        {scoreColumn(2)}
      </Card>

      {winner !== null ? (
        <View style={styles.winnerBanner}>
          <Text style={styles.winnerText}>Ganó {teamLabel(winner)} a {TRUCO_TARGET_SCORE}</Text>
        </View>
      ) : null}

      {!finished ? (
        <Card style={styles.entryCard}>
          <Text style={styles.entryTitle}>Nueva mano</Text>
          <View style={styles.teamsRow}>
            <View style={styles.teamField}>
              <TextField
                keyboardType="number-pad"
                label={teamLabel(1)}
                onChangeText={setTeam1Text}
                placeholder="0"
                value={team1Text}
              />
            </View>
            <View style={styles.teamField}>
              <TextField
                keyboardType="number-pad"
                label={teamLabel(2)}
                onChangeText={setTeam2Text}
                placeholder="0"
                value={team2Text}
              />
            </View>
          </View>
          <Button loading={saving} onPress={submit} title="Anotar mano" />
        </Card>
      ) : null}

      <View style={styles.statusRow}>
        <Button
          onPress={toggleStatus}
          style={styles.flex}
          title={status === 'finished' ? 'Reabrir partida' : 'Finalizar partida'}
          variant="secondary"
        />
      </View>

      <SectionTitle style={styles.section} title="Manos" />
      {rounds.length === 0 ? (
        <Text style={styles.emptyText}>Todavía no se anotó ninguna mano.</Text>
      ) : (
        [...rounds].reverse().map((round) => (
          <View key={round.roundNumber} style={styles.roundRow}>
            <Text style={styles.roundNumber}>Mano {round.roundNumber}</Text>
            <Text style={styles.roundDetail}>{handLabel(round)}</Text>
            {round.roundNumber === rounds[rounds.length - 1].roundNumber ? (
              <Pressable hitSlop={8} onPress={undoLast} style={styles.iconButton}>
                <Ionicons color={colors.danger} name="trash-outline" size={18} />
              </Pressable>
            ) : null}
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  scoreboard: {
    flexDirection: 'row',
    padding: spacing.sm,
  },
  scoreColumn: {
    alignItems: 'center',
    flex: 1,
    padding: spacing.md,
  },
  scoreColumnWinner: {
    backgroundColor: '#ECFDF5',
    borderRadius: 12,
  },
  scoreDivider: {
    backgroundColor: colors.border,
    width: 1,
  },
  teamTitle: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  teamTotal: {
    color: colors.text,
    fontSize: fontSize.xxl,
    fontWeight: '800',
    marginTop: spacing.xs,
  },
  teamHalves: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    marginTop: 2,
  },
  teamPlayers: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  winnerBanner: {
    backgroundColor: colors.success,
    borderRadius: 12,
    marginTop: spacing.md,
    padding: spacing.md,
  },
  winnerText: {
    color: colors.onPrimary,
    fontSize: fontSize.lg,
    fontWeight: '700',
    textAlign: 'center',
  },
  entryCard: {
    marginTop: spacing.md,
  },
  entryTitle: {
    color: colors.text,
    fontSize: fontSize.lg,
    fontWeight: '700',
    marginBottom: spacing.md,
  },
  teamsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  teamField: {
    flex: 1,
  },
  statusRow: {
    flexDirection: 'row',
    marginTop: spacing.md,
  },
  section: {
    marginTop: spacing.xl,
  },
  roundRow: {
    alignItems: 'center',
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    marginBottom: spacing.sm,
    minHeight: 48,
    paddingHorizontal: spacing.md,
  },
  roundNumber: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    fontWeight: '600',
    width: 72,
  },
  roundDetail: {
    color: colors.text,
    flex: 1,
    fontSize: fontSize.md,
    fontWeight: '600',
  },
  iconButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    minWidth: 44,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: fontSize.md,
  },
  flex: {
    flex: 1,
  },
});

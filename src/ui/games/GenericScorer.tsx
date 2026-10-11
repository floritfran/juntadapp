import { useCallback, useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import { Match, MatchStatus, PersonId } from '@/domain/games/game-types';
import { GenericAdjustment } from '@/domain/games/generic/generic-types';
import {
  genericTotals,
  genericWinners,
  validateGenericAdjustment,
} from '@/domain/games/generic/generic-scorer';
import { addGenericAdjustment, listGenericAdjustments, removeLastGenericAdjustment } from '@/infrastructure/persistence/generic-repository';
import { finishMatch, reopenMatch } from '@/infrastructure/persistence/matches-repository';
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

export function GenericScorer({ match, nameOf, onStatusChange }: Props) {
  const db = useSQLiteContext();
  const playerIds = useMemo(() => match.players.map((player) => player.personId), [match.players]);
  const [entries, setEntries] = useState<GenericAdjustment[] | null>(null);
  const [status, setStatus] = useState(match.status);
  const [drafts, setDrafts] = useState<Record<PersonId, string>>({});

  const changeStatus = useCallback(
    (next: MatchStatus) => {
      setStatus(next);
      onStatusChange?.(next);
    },
    [onStatusChange]
  );

  const load = useCallback(async () => {
    setEntries(await listGenericAdjustments(db, match.id));
  }, [db, match.id]);

  useFocusEffect(
    useCallback(() => {
      load().catch(() => setEntries([]));
    }, [load])
  );

  if (entries === null) return null;

  const totals = genericTotals(playerIds, entries);
  const totalByPerson = new Map(totals.map((row) => [row.personId, row.total]));
  const winners = status === 'finished' ? genericWinners(totals) : [];

  const submit = async (personId: PersonId) => {
    const raw = (drafts[personId] ?? '').trim();
    if (raw === '') return;
    const points = Number(raw);
    try {
      validateGenericAdjustment(points);
    } catch {
      Alert.alert('Puntos inválidos', 'Ingresá un número entero distinto de cero.');
      return;
    }
    try {
      await addGenericAdjustment(db, { matchId: match.id, personId, points });
      setDrafts((current) => ({ ...current, [personId]: '' }));
      await load();
    } catch {
      Alert.alert('Error', 'No se pudo guardar el ajuste.');
    }
  };

  const undo = () => {
    if (entries.length === 0) return;
    Alert.alert('Deshacer', '¿Revertir el último ajuste de puntos?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Deshacer',
        style: 'destructive',
        onPress: async () => {
          await removeLastGenericAdjustment(db, match.id);
          await load();
          if (status === 'finished') {
            await reopenMatch(db, match.id);
            changeStatus('active');
          }
        },
      },
    ]);
  };

  const toggleStatus = () => {
    if (status === 'finished') {
      reopenMatch(db, match.id).then(() => changeStatus('active')).catch(() => undefined);
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

  return (
    <View>
      {status === 'finished' ? (
        <View style={styles.winnerBanner}>
          <Text style={styles.winnerText}>
            {winners.length > 1 ? 'Empataron' : 'Ganó'} {winners.map(nameOf).join(' y ')}
          </Text>
        </View>
      ) : null}

      <Card style={styles.standingsCard}>
        {totals.map((row, index) => (
          <View key={row.personId} style={styles.standingRow}>
            <Text style={styles.standingPosition}>{index + 1}.</Text>
            <Text numberOfLines={1} style={[styles.standingName, styles.flex]}>
              {nameOf(row.personId)}
            </Text>
            <Text style={styles.standingTotal}>{row.total}</Text>
          </View>
        ))}
      </Card>

      <View style={styles.statusRow}>
        <Button
          onPress={toggleStatus}
          style={styles.flex}
          title={status === 'finished' ? 'Reabrir partida' : 'Finalizar partida'}
          variant="secondary"
        />
      </View>

      <SectionTitle style={styles.section} title="Puntos por jugador" />
      {playerIds.map((personId) => (
        <Card key={personId} style={styles.playerCard}>
          <View style={styles.playerHeader}>
            <Text numberOfLines={1} style={[styles.playerName, styles.flex]}>
              {nameOf(personId)}
            </Text>
            <Text style={styles.playerTotal}>{totalByPerson.get(personId) ?? 0}</Text>
          </View>
          <View style={styles.addRow}>
            <View style={styles.addInput}>
              <TextField
                keyboardType="numbers-and-punctuation"
                label="Puntos"
                onChangeText={(text) =>
                  setDrafts((current) => ({ ...current, [personId]: text }))
                }
                placeholder="Ej: 10 o -5"
                value={drafts[personId] ?? ''}
              />
            </View>
            <Button
              disabled={status === 'finished'}
              onPress={() => submit(personId)}
              style={styles.addButton}
              title="Agregar"
            />
          </View>
        </Card>
      ))}

      <Button
        disabled={entries.length === 0}
        onPress={undo}
        style={styles.undoButton}
        title="Deshacer último ajuste"
        variant="danger"
      />
    </View>
  );
}

const styles = StyleSheet.create({
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
  standingsCard: {
    marginTop: spacing.md,
    padding: spacing.md,
  },
  standingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: 36,
  },
  standingPosition: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    fontWeight: '600',
    width: 24,
  },
  standingName: {
    color: colors.text,
    fontSize: fontSize.md,
    fontWeight: '600',
  },
  standingTotal: {
    color: colors.text,
    fontSize: fontSize.md,
    fontWeight: '800',
  },
  statusRow: {
    flexDirection: 'row',
    marginTop: spacing.md,
  },
  section: {
    marginTop: spacing.xl,
  },
  playerCard: {
    marginBottom: spacing.md,
    padding: spacing.md,
  },
  playerHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    marginBottom: spacing.sm,
  },
  playerName: {
    color: colors.text,
    fontSize: fontSize.lg,
    fontWeight: '700',
  },
  playerTotal: {
    color: colors.primary,
    fontSize: fontSize.lg,
    fontWeight: '800',
  },
  addRow: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: spacing.md,
  },
  addInput: {
    flex: 1,
  },
  addButton: {
    flex: 1,
    marginBottom: spacing.lg,
  },
  undoButton: {
    marginTop: spacing.sm,
  },
  flex: {
    flex: 1,
  },
});
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import { Match, MatchStatus, PersonId } from '@/domain/games/game-types';
import {
  computeGeneralaTotals,
  generalaStandings,
  generalaWinners,
  isLowerBox,
  isUpperBox,
  nextGeneralaTurn,
} from '@/domain/games/generala/generala-scorer';
import {
  GeneralaBox,
  GENERALA_BOXES,
  GENERALA_BOX_LABELS,
  LOWER_BOX_OPTIONS,
} from '@/domain/games/generala/generala-types';
import { finishMatch, reopenMatch } from '@/infrastructure/persistence/matches-repository';
import { addGeneralaEntry, GeneralaPlayerEntry, listGeneralaEntries } from '@/infrastructure/persistence/generala-repository';
import { Button } from '@/ui/components/Button';
import { Card } from '@/ui/components/Card';
import { Chip } from '@/ui/components/Chip';
import { SectionTitle } from '@/ui/components/SectionTitle';
import { TextField } from '@/ui/components/TextField';
import { colors, fontSize, spacing } from '@/ui/theme';

interface Props {
  match: Match;
  nameOf: (personId: string) => string;
  onStatusChange?: (status: MatchStatus) => void;
}

interface EditingState {
  personId: PersonId;
  box: GeneralaBox;
  existing: GeneralaPlayerEntry | null;
}

export function GeneralaScorer({ match, nameOf, onStatusChange }: Props) {
  const db = useSQLiteContext();
  const order = useMemo(() => match.players.map((player) => player.personId), [match.players]);
  const [entries, setEntries] = useState<GeneralaPlayerEntry[] | null>(null);
  const [status, setStatus] = useState(match.status);
  const changeStatus = useCallback((next: MatchStatus) => {
    setStatus(next);
    onStatusChange?.(next);
  }, [onStatusChange]);
  const [editing, setEditing] = useState<EditingState | null>(null);
  const [pointsText, setPointsText] = useState('');

  const load = useCallback(async () => {
    const result = await listGeneralaEntries(db, match.id);
    setEntries(result);
  }, [db, match.id]);

  useFocusEffect(
    useCallback(() => {
      load().catch(() => setEntries([]));
    }, [load])
  );

  const entriesByPlayer = useMemo(() => {
    const map: Record<string, GeneralaPlayerEntry[]> = {};
    entries?.forEach((entry) => {
      (map[entry.personId] ??= []).push(entry);
    });
    return map;
  }, [entries]);

  const turn = entries === null ? null : nextGeneralaTurn(order, entriesByPlayer);
  const complete = entries !== null && turn === null;

  useEffect(() => {
    if (complete && status === 'active') {
      finishMatch(db, match.id)
        .then(() => changeStatus('finished'))
        .catch(() => undefined);
    }
  }, [complete, status, db, match.id, changeStatus]);

  if (entries === null) return null;

  const openEditor = (state: EditingState) => {
    setEditing(state);
    setPointsText(state.existing ? String(state.existing.points) : '');
  };

  const askEdit = (state: EditingState) => {
    if (!state.existing) {
      openEditor(state);
      return;
    }
    Alert.alert('Corregir casillero', `¿Modificar "${boxLabel(state.box)}" de ${nameOf(state.personId)}?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Modificar', onPress: () => openEditor(state) },
    ]);
  };

  const save = async () => {
    if (!editing) return;
    const points = Number(pointsText.trim());
    if (!Number.isInteger(points) || points < 0) {
      Alert.alert('Puntos inválidos', 'Ingresá un número entero mayor o igual a cero.');
      return;
    }
    try {
      await addGeneralaEntry(db, {
        matchId: match.id,
        personId: editing.personId,
        box: editing.box,
        points,
        tachado: false,
      });
      setEditing(null);
      await load();
    } catch {
      Alert.alert('Error', 'No se pudo guardar el casillero.');
    }
  };

  const tachar = async () => {
    if (!editing) return;
    try {
      await addGeneralaEntry(db, {
        matchId: match.id,
        personId: editing.personId,
        box: editing.box,
        points: 0,
        tachado: true,
      });
      setEditing(null);
      await load();
    } catch {
      Alert.alert('Error', 'No se pudo tachar el casillero.');
    }
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

  const standings = generalaStandings(order, entriesByPlayer);
  const winners = complete ? generalaWinners(order, entriesByPlayer) : [];

  const renderBoxRow = (personId: PersonId, box: GeneralaBox) => {
    const existing = entriesByPlayer[personId]?.find((entry) => entry.box === box) ?? null;
    const canFill = !existing && turn?.personId === personId;
    const onPress = existing ? () => askEdit({ personId, box, existing }) : canFill ? () => openEditor({ personId, box, existing: null }) : undefined;
    return (
      <Pressable
        key={box}
        disabled={!onPress}
        onPress={onPress}
        style={[styles.boxRow, canFill && styles.boxRowAvailable, existing?.tachado && styles.boxRowTachado]}
      >
        <Text style={[styles.boxLabel, canFill && styles.boxLabelAvailable]}>{boxLabel(box)}</Text>
        <Text style={[styles.boxPoints, canFill && styles.boxLabelAvailable]}>
          {existing ? (existing.tachado ? 'Tachado' : String(existing.points)) : canFill ? 'Cargar' : '—'}
        </Text>
      </Pressable>
    );
  };

  return (
    <View>
      {complete ? (
        <View style={styles.winnerBanner}>
          <Text style={styles.winnerText}>
            {winners.length > 1 ? 'Empataron' : 'Ganó'} {winners.map(nameOf).join(' y ')}
          </Text>
        </View>
      ) : turn ? (
        <View style={styles.turnBanner}>
          <Text style={styles.turnText}>Le toca a {nameOf(turn.personId)}</Text>
        </View>
      ) : null}

      <Card style={styles.standingsCard}>
        {standings.map((row, index) => (
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

      <SectionTitle style={styles.section} title="Planchas" />
      {order.map((personId) => {
        const playerEntries = entriesByPlayer[personId] ?? [];
        const totals = computeGeneralaTotals(playerEntries);
        return (
          <Card key={personId} style={styles.sheetCard}>
            <View style={styles.sheetHeader}>
              <Text numberOfLines={1} style={[styles.sheetName, styles.flex]}>
                {nameOf(personId)}
              </Text>
              <Text style={styles.sheetTotal}>{totals.total} pts</Text>
            </View>
            <Text style={styles.sheetSubtotal}>
              Altos {totals.upper} {totals.upperBonus > 0 ? `(+${totals.upperBonus} bonif.)` : ''} · Bajos {totals.lower}
            </Text>
            <View style={styles.boxes}>
              {GENERALA_BOXES.map((box) => renderBoxRow(personId, box))}
            </View>
          </Card>
        );
      })}

      <Modal animationType="slide" onRequestClose={() => setEditing(null)} transparent visible={editing !== null}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            {editing ? (
              <>
                <Text style={styles.modalTitle}>{boxLabel(editing.box)}</Text>
                <Text style={styles.modalSubtitle}>{nameOf(editing.personId)}</Text>
                {!isUpperBox(editing.box) && isLowerBox(editing.box) ? (
                  <View style={styles.chipsRow}>
                    {LOWER_BOX_OPTIONS[editing.box].map((option) => (
                      <Chip
                        key={option}
                        label={String(option)}
                        onPress={() => setPointsText(String(option))}
                        selected={pointsText.trim() === String(option)}
                      />
                    ))}
                  </View>
                ) : null}
                <TextField
                  keyboardType="number-pad"
                  label="Puntos"
                  onChangeText={setPointsText}
                  placeholder="Ej: 25"
                  value={pointsText}
                />
                <View style={styles.modalActions}>
                  <Button onPress={save} style={styles.flex} title="Guardar" />
                  <Button onPress={tachar} style={styles.flex} title="Tachar (0)" variant="secondary" />
                </View>
                <Button onPress={() => setEditing(null)} title="Cancelar" variant="danger" />
              </>
            ) : null}
          </View>
        </View>
      </Modal>
    </View>
  );
}

function boxLabel(box: GeneralaBox): string {
  return GENERALA_BOX_LABELS[box];
}

const styles = StyleSheet.create({
  turnBanner: {
    backgroundColor: colors.primarySoft,
    borderRadius: 12,
    padding: spacing.md,
  },
  turnText: {
    color: colors.primary,
    fontSize: fontSize.lg,
    fontWeight: '700',
    textAlign: 'center',
  },
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
  sheetCard: {
    marginBottom: spacing.md,
    padding: spacing.md,
  },
  sheetHeader: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  sheetName: {
    color: colors.text,
    fontSize: fontSize.lg,
    fontWeight: '700',
  },
  sheetTotal: {
    color: colors.primary,
    fontSize: fontSize.lg,
    fontWeight: '800',
  },
  sheetSubtotal: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    marginBottom: spacing.sm,
  },
  boxes: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  boxRow: {
    alignItems: 'center',
    backgroundColor: colors.bg,
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
    minHeight: 44,
    paddingHorizontal: spacing.md,
    width: '48%',
  },
  boxRowAvailable: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
    borderStyle: 'dashed',
  },
  boxRowTachado: {
    opacity: 0.6,
  },
  boxLabel: {
    color: colors.text,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  boxPoints: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  boxLabelAvailable: {
    color: colors.primary,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  modalBackdrop: {
    backgroundColor: 'rgba(17, 24, 39, 0.45)',
    flex: 1,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modalCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: spacing.lg,
  },
  modalTitle: {
    color: colors.text,
    fontSize: fontSize.xl,
    fontWeight: '700',
  },
  modalSubtitle: {
    color: colors.textMuted,
    fontSize: fontSize.md,
    marginBottom: spacing.md,
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  flex: {
    flex: 1,
  },
});

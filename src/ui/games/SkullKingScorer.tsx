import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import { Match, MatchStatus, PersonId } from '@/domain/games/game-types';
import {
  skullKingRoundPoints,
  skullKingTotals,
  validateSkullKingEntry,
} from '@/domain/games/skull-king/skull-king-scorer';
import {
  cardsInRound,
  COMBAT_BONUSES,
  SKULL_KING_TOTAL_ROUNDS,
  SkullKingRoundEntry,
} from '@/domain/games/skull-king/skull-king-types';
import { finishMatch, reopenMatch } from '@/infrastructure/persistence/matches-repository';
import {
  listSkullKingEntries,
  removeLastSkullKingRound,
  saveSkullKingRound,
} from '@/infrastructure/persistence/skull-king-repository';
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

interface DraftRow {
  bid: number;
  tricks: number;
  bonus: number;
}

function Stepper({
  value,
  max,
  onChange,
}: {
  value: number;
  max: number;
  onChange: (next: number) => void;
}) {
  return (
    <View style={styles.stepper}>
      <Pressable onPress={() => onChange(Math.max(0, value - 1))} style={styles.stepButton}>
        <Text style={styles.stepSign}>−</Text>
      </Pressable>
      <Text style={styles.stepValue}>{value}</Text>
      <Pressable onPress={() => onChange(Math.min(max, value + 1))} style={styles.stepButton}>
        <Text style={styles.stepSign}>+</Text>
      </Pressable>
    </View>
  );
}

export function SkullKingScorer({ match, nameOf, onStatusChange }: Props) {
  const db = useSQLiteContext();
  const playerIds = useMemo(() => match.players.map((player) => player.personId), [match.players]);
  const [entries, setEntries] = useState<SkullKingRoundEntry[] | null>(null);
  const [status, setStatus] = useState(match.status);
  const changeStatus = useCallback((next: MatchStatus) => {
    setStatus(next);
    onStatusChange?.(next);
  }, [onStatusChange]);
  const [drafts, setDrafts] = useState<Record<number, Record<PersonId, DraftRow>>>({});
  const [bonusText, setBonusText] = useState<Record<PersonId, string>>({});

  const load = useCallback(async () => {
    const result = await listSkullKingEntries(db, match.id);
    setEntries(result);
  }, [db, match.id]);

  useFocusEffect(
    useCallback(() => {
      load().catch(() => setEntries([]));
    }, [load])
  );

  const currentRound = useMemo(() => {
    if (!entries) return null;
    for (let round = 1; round <= SKULL_KING_TOTAL_ROUNDS; round += 1) {
      const inRound = entries.filter((entry) => entry.round === round).length;
      if (inRound < playerIds.length) return round;
    }
    return null;
  }, [entries, playerIds.length]);

  const complete = entries !== null && currentRound === null;

  useEffect(() => {
    if (complete && status === 'active') {
      finishMatch(db, match.id)
        .then(() => changeStatus('finished'))
        .catch(() => undefined);
    }
  }, [complete, status, db, match.id, changeStatus]);

  if (entries === null) return null;

  const maxCards = currentRound !== null ? cardsInRound(currentRound) : 0;

  const defaultRow = (round: number, personId: PersonId): DraftRow => {
    const existing = entries.find((entry) => entry.round === round && entry.personId === personId);
    return existing
      ? { bid: existing.bid, tricks: existing.tricks, bonus: existing.bonus }
      : { bid: 0, tricks: 0, bonus: 0 };
  };

  const rowFor = (round: number, personId: PersonId): DraftRow =>
    drafts[round]?.[personId] ?? defaultRow(round, personId);

  const updateDraft = (round: number, personId: PersonId, patch: Partial<DraftRow>) => {
    setDrafts((current) => {
      const roundDraft = current[round] ?? {};
      const base = roundDraft[personId] ?? defaultRow(round, personId);
      return { ...current, [round]: { ...roundDraft, [personId]: { ...base, ...patch } } };
    });
  };

  const applyFreeBonus = (personId: PersonId, sign: 1 | -1) => {
    if (currentRound === null) return;
    const raw = (bonusText[personId] ?? '').trim();
    if (!raw) return;
    const amount = Number(raw);
    if (!Number.isInteger(amount) || amount <= 0) {
      Alert.alert('Monto inválido', 'Ingresá un número entero mayor a cero.');
      return;
    }
    const current = rowFor(currentRound, personId).bonus;
    updateDraft(currentRound, personId, { bonus: current + sign * amount });
    setBonusText((value) => ({ ...value, [personId]: '' }));
  };

  const confirmRound = async () => {
    if (currentRound === null) return;
    const roundEntries: SkullKingRoundEntry[] = [];
    for (const personId of playerIds) {
            const row = rowFor(currentRound, personId);
      const entry: SkullKingRoundEntry = { round: currentRound, personId, ...row };
      try {
        validateSkullKingEntry(entry);
      } catch (error) {
        Alert.alert('Revisá los datos', `${nameOf(personId)}: ${(error as Error).message}`);
        return;
      }
      roundEntries.push(entry);
    }
    try {
      await saveSkullKingRound(db, match.id, roundEntries);
      await load();
    } catch {
      Alert.alert('Error', 'No se pudo guardar la ronda.');
    }
  };

  const undoLastRound = () => {
    const lastRound = Math.max(
      ...entries.map((entry) => entry.round),
      0
    );
    if (lastRound === 0) return;
    Alert.alert('Deshacer ronda', `¿Eliminar la ronda ${lastRound} y su carga?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          await removeLastSkullKingRound(db, match.id);
          setEntries(await listSkullKingEntries(db, match.id));
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

  const totals = skullKingTotals(entries);
  const completedRounds = [...new Set(entries.map((entry) => entry.round))].sort((a, b) => a - b);
  const historyRounds = currentRound === null ? completedRounds : completedRounds.filter((round) => round < currentRound);

  return (
    <View>
      <View style={styles.progressRow}>
        <Text style={styles.progressText}>
          {complete
            ? 'Partida completa'
            : `Ronda ${currentRound} de ${SKULL_KING_TOTAL_ROUNDS}`}
        </Text>
      </View>

      {complete ? (
        <View style={styles.winnerBanner}>
          <Text style={styles.winnerText}>
            Ganó {nameOf(totals[0]?.personId ?? '')} · {totals[0]?.total ?? 0} pts
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

      {currentRound !== null ? (
        <>
          <SectionTitle style={styles.section} title={`Ronda ${currentRound}`} />
          {playerIds.map((personId) => {
      const row = rowFor(currentRound, personId);
            const preview = skullKingRoundPoints({ round: currentRound, personId, ...row });
            return (
              <Card key={personId} style={styles.playerCard}>
                <View style={styles.playerHeader}>
                  <Text numberOfLines={1} style={[styles.playerName, styles.flex]}>
                    {nameOf(personId)}
                  </Text>
                  <Text
                    style={[styles.preview, { color: preview >= 0 ? colors.success : colors.danger }]}
                  >
                    {preview >= 0 ? `+${preview}` : preview}
                  </Text>
                </View>

                <View style={styles.fieldRow}>
                  <Text style={styles.fieldLabel}>Apuesta</Text>
                  <Stepper
                    max={maxCards}
                    onChange={(next) => updateDraft(currentRound, personId, { bid: next })}
                    value={row.bid}
                  />
                </View>
                <View style={styles.fieldRow}>
                  <Text style={styles.fieldLabel}>Bazas</Text>
                  <Stepper
                    max={maxCards}
                    onChange={(next) => updateDraft(currentRound, personId, { tricks: next })}
                    value={row.tricks}
                  />
                </View>

                <Text style={styles.bonusTitle}>Bonificaciones {row.bonus !== 0 ? `(${row.bonus > 0 ? '+' : ''}${row.bonus})` : ''}</Text>
                <View style={styles.chipsRow}>
                  {COMBAT_BONUSES.map((bonus) => (
                    <Chip
                      key={bonus.id}
                      label={`${bonus.label} +${bonus.points}`}
                      onPress={() => updateDraft(currentRound, personId, { bonus: row.bonus + bonus.points })}
                    />
                  ))}
                </View>
                <View style={styles.freeBonusRow}>
                  <View style={styles.freeBonusInput}>
                    <TextField
                      keyboardType="number-pad"
                      label="Otra bonificación"
                      onChangeText={(text) => setBonusText((value) => ({ ...value, [personId]: text }))}
                      placeholder="Monto"
                      value={bonusText[personId] ?? ''}
                    />
                  </View>
                  <Pressable onPress={() => applyFreeBonus(personId, 1)} style={styles.freeBonusButton}>
                    <Text style={styles.freeBonusSign}>+ Sumar</Text>
                  </Pressable>
                  <Pressable onPress={() => applyFreeBonus(personId, -1)} style={styles.freeBonusButton}>
                    <Text style={[styles.freeBonusSign, styles.freeBonusMinus]}>− Restar</Text>
                  </Pressable>
                </View>
              </Card>
            );
          })}
          <Button onPress={confirmRound} title={`Confirmar ronda ${currentRound}`} />
        </>
      ) : null}

      <SectionTitle style={styles.section} title="Rondas anteriores" />
      {historyRounds.length === 0 ? (
        <Text style={styles.emptyText}>Todavía no se completó ninguna ronda.</Text>
      ) : (
        [...historyRounds].reverse().map((round) => {
          const isLast = round === Math.max(...historyRounds);
          return (
            <Card key={round} style={styles.historyCard}>
              <View style={styles.historyHeader}>
                <Text style={styles.historyTitle}>Ronda {round}</Text>
                {isLast && !complete ? (
                  <Pressable hitSlop={8} onPress={undoLastRound}>
                    <Text style={styles.undoText}>Deshacer</Text>
                  </Pressable>
                ) : null}
              </View>
              {playerIds.map((personId) => {
                const entry = entries.find(
                  (value) => value.round === round && value.personId === personId
                );
                if (!entry) return null;
                const points = skullKingRoundPoints(entry);
                return (
                  <View key={personId} style={styles.historyRow}>
                    <Text numberOfLines={1} style={[styles.historyName, styles.flex]}>
                      {nameOf(personId)}
                    </Text>
                    <Text style={styles.historyDetail}>
                      ap {entry.bid} · bazas {entry.tricks}
                      {entry.bonus !== 0 ? ` · bonos ${entry.bonus > 0 ? '+' : ''}${entry.bonus}` : ''}
                    </Text>
                    <Text
                      style={[styles.historyPoints, { color: points >= 0 ? colors.success : colors.danger }]}
                    >
                      {points >= 0 ? `+${points}` : points}
                    </Text>
                  </View>
                );
              })}
            </Card>
          );
        })
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  progressRow: {
    backgroundColor: colors.primarySoft,
    borderRadius: 12,
    padding: spacing.md,
  },
  progressText: {
    color: colors.primary,
    fontSize: fontSize.lg,
    fontWeight: '700',
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
  preview: {
    fontSize: fontSize.lg,
    fontWeight: '800',
  },
  fieldRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  fieldLabel: {
    color: colors.text,
    fontSize: fontSize.md,
    fontWeight: '600',
  },
  stepper: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  stepButton: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: 999,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  stepSign: {
    color: colors.primary,
    fontSize: fontSize.xl,
    fontWeight: '700',
  },
  stepValue: {
    color: colors.text,
    fontSize: fontSize.lg,
    fontWeight: '800',
    minWidth: 40,
    textAlign: 'center',
  },
  bonusTitle: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    fontWeight: '600',
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  freeBonusRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  freeBonusInput: {
    flex: 1,
  },
  freeBonusButton: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: 10,
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: spacing.md,
  },
  freeBonusSign: {
    color: colors.primary,
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  freeBonusMinus: {
    color: colors.danger,
  },
  historyCard: {
    marginBottom: spacing.sm,
    padding: spacing.md,
  },
  historyHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  historyTitle: {
    color: colors.text,
    fontSize: fontSize.md,
    fontWeight: '700',
  },
  undoText: {
    color: colors.danger,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  historyRow: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: 30,
  },
  historyName: {
    color: colors.text,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  historyDetail: {
    color: colors.textMuted,
    flex: 1,
    fontSize: fontSize.sm,
    textAlign: 'right',
  },
  historyPoints: {
    fontSize: fontSize.sm,
    fontWeight: '800',
    marginLeft: spacing.sm,
    minWidth: 44,
    textAlign: 'right',
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: fontSize.md,
  },
  flex: {
    flex: 1,
  },
});

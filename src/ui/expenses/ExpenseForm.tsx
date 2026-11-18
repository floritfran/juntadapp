import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import { matchesQuery } from '@/domain/common/text-search';
import { calculateSplitShares, formatPercentageInput, parsePercentageInput, PERCENTAGE_TOTAL_BPS, validateSplit, type SplitValidationError } from '@/domain/expenses/expense-splits';
import { ExpenseId, SplitMode, SplitValues } from '@/domain/expenses/expense-types';
import { GetTogether } from '@/domain/get-togethers/get-together-types';
import { Person, PersonId } from '@/domain/people/person-types';
import { createExpense, updateExpense } from '@/infrastructure/persistence/expenses-repository';
import { Button } from '@/ui/components/Button';
import { CheckRow } from '@/ui/components/CheckRow';
import { Chip } from '@/ui/components/Chip';
import { EmptyState } from '@/ui/components/EmptyState';
import { Screen } from '@/ui/components/Screen';
import { SearchField } from '@/ui/components/SearchField';
import { SectionTitle } from '@/ui/components/SectionTitle';
import { TextField } from '@/ui/components/TextField';
import { formatMoney, groupDigits, parseAmountToInt } from '@/ui/format';
import { fontSize, spacing, useColors, type Colors } from '@/ui/theme';

interface ExpenseFormProps {
  getTogether: GetTogether;
  people: Person[];
  expenseId?: ExpenseId;
  initialDescription?: string;
  initialAmountInt?: number;
  initialPayerId?: PersonId | null;
  initialParticipantIds?: PersonId[];
  initialSplitMode?: SplitMode | null;
  initialSplitValues?: SplitValues | null;
}

function evenBps(count: number): number[] {
  if (count <= 0) return [];
  const base = Math.floor(PERCENTAGE_TOTAL_BPS / count);
  const remainder = PERCENTAGE_TOTAL_BPS % count;
  return Array.from({ length: count }, (_, index) => base + (index < remainder ? 1 : 0));
}

function buildSplitInputs(
  mode: SplitMode,
  amountInt: number,
  participantIds: PersonId[],
  values?: SplitValues | null
): Record<PersonId, string> {
  const evenShares = calculateSplitShares('equal', amountInt, participantIds);
  const percentages = evenBps(participantIds.length);
  const usableValues =
    values != null && validateSplit(mode, amountInt, participantIds, values) === null
      ? values
      : null;

  return Object.fromEntries(
    participantIds.map((personId, index) => {
      if (mode === 'exact') {
        const value = usableValues?.[personId] ?? evenShares[personId] ?? 0;
        return [personId, String(value)];
      }
      if (mode === 'percentage') {
        const value = usableValues?.[personId] ?? percentages[index] ?? 0;
        return [personId, formatPercentageInput(value)];
      }
      return [personId, ''];
    })
  );
}

function readSplitValues(
  mode: SplitMode,
  participantIds: PersonId[],
  inputs: Record<PersonId, string>
): SplitValues {
  return Object.fromEntries(
    participantIds.map((personId) => {
      const text = inputs[personId] ?? '';
      const value =
        mode === 'exact'
          ? parseAmountToInt(text)
          : parsePercentageInput(text) ?? Number.NaN;
      return [personId, value];
    })
  );
}

function cleanPercentageText(text: string): string {
  const [whole, ...decimals] = text.replace(',', '.').split('.');
  const digits = whole.replace(/\D/g, '').slice(0, 3);
  if (decimals.length === 0) return digits;
  return `${digits}.${decimals.join('').replace(/\D/g, '').slice(0, 2)}`;
}

function splitErrorMessage(mode: SplitMode, error: Exclude<SplitValidationError, null>): string {
  if (error === 'missing') return 'Ingresá un valor para cada participante.';
  if (error === 'negative') return 'Los valores no pueden ser negativos.';
  if (error === 'invalid') {
    return mode === 'percentage'
      ? 'Usá porcentajes de 0 a 100 con hasta dos decimales.'
      : 'Ingresá montos enteros sin centavos.';
  }
  return mode === 'percentage'
    ? 'Los porcentajes deben sumar 100%.'
    : 'Los montos deben sumar el total del gasto.';
}

export function ExpenseForm({
  getTogether,
  people,
  expenseId,
  initialDescription = '',
  initialAmountInt = 0,
  initialPayerId = null,
  initialParticipantIds,
  initialSplitMode = 'equal',
  initialSplitValues = null,
}: ExpenseFormProps) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const db = useSQLiteContext();
  const [description, setDescription] = useState(initialDescription);
  const [amountText, setAmountText] = useState(
    initialAmountInt > 0 ? groupDigits(String(initialAmountInt)) : ''
  );
  const [payerId, setPayerId] = useState<PersonId | null>(
    initialPayerId ?? getTogether.participantIds[0] ?? null
  );
  const [participantIds, setParticipantIds] = useState<PersonId[]>(
    initialParticipantIds ?? getTogether.participantIds
  );
  const [splitMode, setSplitMode] = useState<SplitMode>(initialSplitMode ?? 'equal');
  const [splitInputs, setSplitInputs] = useState<Record<PersonId, string>>(() =>
    buildSplitInputs(
      initialSplitMode ?? 'equal',
      initialAmountInt,
      initialParticipantIds ?? getTogether.participantIds,
      initialSplitValues
    )
  );
  const [saving, setSaving] = useState(false);
  const [personQuery, setPersonQuery] = useState('');

  const amountInt = parseAmountToInt(amountText);
  const splitValues = useMemo(
    () => (splitMode === 'equal' ? null : readSplitValues(splitMode, participantIds, splitInputs)),
    [splitMode, participantIds, splitInputs]
  );
  const splitError = validateSplit(splitMode, amountInt, participantIds, splitValues);
  const splitTotal = splitValues
    ? participantIds.reduce((total, personId) => total + (splitValues[personId] || 0), 0)
    : 0;
  const splitSummary =
    splitMode === 'equal'
      ? 'La división se reparte en partes iguales entre los participantes.'
      : !Number.isFinite(splitTotal)
        ? 'Completá un valor para cada participante.'
        : splitMode === 'percentage'
          ? `Porcentajes: ${formatPercentageInput(splitTotal)}% de 100%.`
          : `Cuotas: ${formatMoney(splitTotal)} de ${formatMoney(amountInt)}.`;

  const onAmountChange = (text: string) => setAmountText(groupDigits(text.replace(/\D/g, '')));

  const changeSplitMode = (nextMode: SplitMode) => {
    setSplitMode(nextMode);
    setSplitInputs(
      buildSplitInputs(nextMode, amountInt, participantIds, readSplitValues(splitMode, participantIds, splitInputs))
    );
  };

  const toggleParticipant = (personId: PersonId) => {
    const removing = participantIds.includes(personId);
    if (!removing && splitMode !== 'equal') {
      setSplitInputs((current) => ({ ...current, [personId]: '0' }));
    }
    setParticipantIds((ids) =>
      removing ? ids.filter((id) => id !== personId) : [...ids, personId]
    );
  };

  const changeSplitInput = (personId: PersonId, text: string) => {
    setSplitInputs((current) => ({
      ...current,
      [personId]: splitMode === 'exact' ? groupDigits(text.replace(/\D/g, '')) : cleanPercentageText(text),
    }));
  };

  const submit = async () => {
    if (!description.trim()) {
      Alert.alert('Falta la descripción', 'Contá de qué fue el gasto.');
      return;
    }
    if (amountInt <= 0) {
      Alert.alert('Monto inválido', 'Ingresá un monto mayor a cero.');
      return;
    }
    if (!payerId) {
      Alert.alert('Sin pagador', 'Elegí quién pagó.');
      return;
    }
    if (participantIds.length === 0) {
      Alert.alert('Sin participantes', 'Elegí al menos una persona para este gasto.');
      return;
    }
    if (splitError !== null) {
      Alert.alert('Reparto inválido', splitErrorMessage(splitMode, splitError));
      return;
    }
    setSaving(true);
    try {
      if (expenseId) {
        await updateExpense(db, expenseId, {
          payerId,
          description,
          amountInt,
          participantIds,
          splitMode,
          splitValues,
        });
      } else {
        await createExpense(db, {
          getTogetherId: getTogether.id,
          payerId,
          description,
          amountInt,
          participantIds,
          splitMode,
          splitValues,
        });
      }
      router.back();
    } catch {
      Alert.alert('Error', 'No se pudo guardar el gasto.');
      setSaving(false);
    }
  };

  const participants = getTogether.participantIds
    .map((personId) => people.find((person) => person.id === personId))
    .filter((person): person is Person => person != null);

  const filteredParticipants = useMemo(
    () => participants.filter((person) => matchesQuery(person.name, personQuery)),
    [participants, personQuery]
  );

  if (participants.length === 0) {
    return (
      <Screen>
        <EmptyState
          icon="alert-circle-outline"
          message="No pudimos cargar los participantes de esta juntada."
          title="Sin participantes"
        >
          <Button onPress={() => router.back()} style={styles.emptyButton} title="Volver" variant="secondary" />
        </EmptyState>
      </Screen>
    );
  }

  return (
    <Screen>
      <FlatList
        contentContainerStyle={styles.content}
        data={filteredParticipants}
        keyExtractor={(person) => person.id}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        ListFooterComponent={
          filteredParticipants.length > 0 ? (
            <Text style={[styles.hint, splitError !== null && styles.hintError]}>
              {splitSummary}
            </Text>
          ) : undefined
        }
        ListHeaderComponent={
          <>
            <TextField
              autoCapitalize="sentences"
              label="Descripción"
              onChangeText={setDescription}
              placeholder="Ej: Carne para el asado"
              value={description}
            />
            <TextField
              keyboardType="number-pad"
              label="Monto ($)"
              onChangeText={onAmountChange}
              placeholder="0"
              value={amountText}
            />
            {amountInt > 0 ? <Text style={styles.amountPreview}>{formatMoney(amountInt)}</Text> : null}

            <SearchField onChangeText={setPersonQuery} value={personQuery} />
            {filteredParticipants.length === 0 ? (
              <Text style={styles.hint}>No se encontraron personas.</Text>
            ) : (
              <>
                <SectionTitle style={styles.section} title="¿Quién pagó?" />
                <View style={styles.chipsRow}>
                  {filteredParticipants.map((person) => (
                    <Chip
                      key={person.id}
                      label={person.name}
                      onPress={() => setPayerId(person.id)}
                      selected={payerId === person.id}
                    />
                  ))}
                </View>

                <SectionTitle style={styles.section} title="Reparto" />
                <View style={styles.chipsRow}>
                  <Chip label="Igualitario" onPress={() => changeSplitMode('equal')} selected={splitMode === 'equal'} />
                  <Chip label="Montos" onPress={() => changeSplitMode('exact')} selected={splitMode === 'exact'} />
                  <Chip label="Porcentajes" onPress={() => changeSplitMode('percentage')} selected={splitMode === 'percentage'} />
                </View>

                <SectionTitle style={styles.section} title="¿Quiénes participan?" />
              </>
            )}
          </>
        }
        renderItem={({ item: person }) => {
          const checked = participantIds.includes(person.id);
          return (
            <View style={styles.participantRow}>
              <CheckRow checked={checked} label={person.name} onToggle={() => toggleParticipant(person.id)} />
              {checked && splitMode !== 'equal' ? (
                <View style={styles.splitInput}>
                  <TextField
                    keyboardType={splitMode === 'exact' ? 'number-pad' : 'decimal-pad'}
                    label={splitMode === 'exact' ? 'Monto ($)' : 'Porcentaje (%)'}
                    onChangeText={(text) => changeSplitInput(person.id, text)}
                    placeholder="0"
                    value={splitInputs[person.id] ?? ''}
                  />
                </View>
              ) : null}
            </View>
          );
        }}
        style={styles.list}
      />
      <View style={styles.footer}>
        <Button
          loading={saving}
          onPress={submit}
          title={expenseId ? 'Guardar cambios' : 'Guardar gasto'}
        />
      </View>
    </Screen>
  );
}

export function ExpenseFormLoading() {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <Screen>
      <View style={styles.loading}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    </Screen>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  list: {
    flex: 1,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: spacing.lg,
    paddingBottom: 48,
  },
  amountPreview: {
    color: colors.primary,
    fontSize: fontSize.lg,
    fontWeight: '700',
    marginTop: -spacing.md,
    marginBottom: spacing.md,
  },
  section: {
    marginTop: spacing.md,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  hint: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    marginTop: spacing.md,
  },
  hintError: {
    color: colors.danger,
  },
  participantRow: {
    marginBottom: spacing.sm,
  },
  splitInput: {
    marginLeft: spacing.xl + spacing.md,
    marginTop: -spacing.sm,
  },
  emptyButton: {
    marginTop: spacing.lg,
  },
  footer: {
    backgroundColor: colors.bg,
    padding: spacing.lg,
  },
});

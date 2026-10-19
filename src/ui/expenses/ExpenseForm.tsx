import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import { ExpenseId } from '@/domain/expenses/expense-types';
import { GetTogether } from '@/domain/get-togethers/get-together-types';
import { Person, PersonId } from '@/domain/people/person-types';
import { createExpense, updateExpense } from '@/infrastructure/persistence/expenses-repository';
import { Button } from '@/ui/components/Button';
import { CheckRow } from '@/ui/components/CheckRow';
import { Chip } from '@/ui/components/Chip';
import { EmptyState } from '@/ui/components/EmptyState';
import { Screen } from '@/ui/components/Screen';
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
}

export function ExpenseForm({
  getTogether,
  people,
  expenseId,
  initialDescription = '',
  initialAmountInt = 0,
  initialPayerId = null,
  initialParticipantIds,
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
  const [saving, setSaving] = useState(false);

  const amountInt = parseAmountToInt(amountText);

  const onAmountChange = (text: string) => setAmountText(groupDigits(text.replace(/\D/g, '')));

  const toggleParticipant = (personId: PersonId) =>
    setParticipantIds((ids) =>
      ids.includes(personId) ? ids.filter((id) => id !== personId) : [...ids, personId]
    );

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
    setSaving(true);
    try {
      if (expenseId) {
        await updateExpense(db, expenseId, { payerId, description, amountInt, participantIds });
      } else {
        await createExpense(db, {
          getTogetherId: getTogether.id,
          payerId,
          description,
          amountInt,
          participantIds,
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
      <ScrollView contentContainerStyle={styles.content}>
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

        <SectionTitle style={styles.section} title="¿Quién pagó?" />
        <View style={styles.chipsRow}>
          {participants.map((person) => (
            <Chip
              key={person.id}
              label={person.name}
              onPress={() => setPayerId(person.id)}
              selected={payerId === person.id}
            />
          ))}
        </View>

        <SectionTitle style={styles.section} title="¿Quiénes participan?" />
        {participants.map((person) => (
          <CheckRow
            checked={participantIds.includes(person.id)}
            key={person.id}
            label={person.name}
            onToggle={() => toggleParticipant(person.id)}
          />
        ))}
        <Text style={styles.hint}>
          La división se reparte en partes iguales entre los participantes.
        </Text>
      </ScrollView>
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
  emptyButton: {
    marginTop: spacing.lg,
  },
  footer: {
    backgroundColor: colors.bg,
    padding: spacing.lg,
  },
});

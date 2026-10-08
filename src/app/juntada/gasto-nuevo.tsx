import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import { GetTogether } from '@/domain/get-togethers/get-together-types';
import { Person, PersonId } from '@/domain/people/person-types';
import { createExpense } from '@/infrastructure/persistence/expenses-repository';
import { getGetTogether } from '@/infrastructure/persistence/get-togethers-repository';
import { listAllPeople } from '@/infrastructure/persistence/people-repository';
import { Button } from '@/ui/components/Button';
import { CheckRow } from '@/ui/components/CheckRow';
import { Chip } from '@/ui/components/Chip';
import { EmptyState } from '@/ui/components/EmptyState';
import { Screen } from '@/ui/components/Screen';
import { SectionTitle } from '@/ui/components/SectionTitle';
import { TextField } from '@/ui/components/TextField';
import { formatMoney, groupDigits, parseAmountToInt } from '@/ui/format';
import { colors, fontSize, spacing } from '@/ui/theme';

export default function NuevoGastoScreen() {
  const db = useSQLiteContext();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [getTogether, setGetTogether] = useState<GetTogether | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [ready, setReady] = useState(false);
  const [description, setDescription] = useState('');
  const [amountText, setAmountText] = useState('');
  const [payerId, setPayerId] = useState<PersonId | null>(null);
  const [participantIds, setParticipantIds] = useState<PersonId[]>([]);
  const [saving, setSaving] = useState(false);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const [getTogetherResult, allPeople] = await Promise.all([
          getGetTogether(db, id),
          listAllPeople(db),
        ]);
        setGetTogether(getTogetherResult);
        setPeople(allPeople);
        if (getTogetherResult) {
          setParticipantIds(getTogetherResult.participantIds);
          setPayerId(getTogetherResult.participantIds[0] ?? null);
        }
        setReady(true);
      })().catch(() => setReady(true));
    }, [db, id])
  );

  const amountInt = parseAmountToInt(amountText);

  const onAmountChange = (text: string) => setAmountText(groupDigits(text.replace(/\D/g, '')));

  const toggleParticipant = (personId: PersonId) =>
    setParticipantIds((ids) =>
      ids.includes(personId) ? ids.filter((id) => id !== personId) : [...ids, personId]
    );

  const submit = async () => {
    if (!id || !getTogether) return;
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
      await createExpense(db, {
        getTogetherId: id,
        payerId,
        description,
        amountInt,
        participantIds,
      });
      router.back();
    } catch {
      Alert.alert('Error', 'No se pudo guardar el gasto.');
      setSaving(false);
    }
  };

  if (!ready) {
    return (
      <Screen>
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      </Screen>
    );
  }

  if (!getTogether) {
    return (
      <Screen>
        <EmptyState
          icon="alert-circle-outline"
          title="Juntada no encontrada"
          message="No pudimos cargar esta juntada."
        >
          <Button onPress={() => router.back()} style={styles.emptyButton} title="Volver" variant="secondary" />
        </EmptyState>
      </Screen>
    );
  }

  const participants = getTogether.participantIds
    .map((personId) => people.find((person) => person.id === personId))
    .filter((person): person is Person => person != null);

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
        <Button loading={saving} onPress={submit} title="Guardar gasto" />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
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

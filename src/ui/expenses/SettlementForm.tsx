import { useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import { Person, PersonId } from '@/domain/people/person-types';
import { createSettlement } from '@/infrastructure/persistence/settlements-repository';
import { Button } from '@/ui/components/Button';
import { Chip } from '@/ui/components/Chip';
import { EmptyState } from '@/ui/components/EmptyState';
import { Screen } from '@/ui/components/Screen';
import { SectionTitle } from '@/ui/components/SectionTitle';
import { TextField } from '@/ui/components/TextField';
import { formatMoney, groupDigits, parseAmountToInt } from '@/ui/format';
import { colors, fontSize, spacing } from '@/ui/theme';

interface SettlementFormProps {
  getTogetherId: string;
  people: Person[];
  participantIds: PersonId[];
  initialFromId?: PersonId | null;
  initialToId?: PersonId | null;
  initialAmountInt?: number;
}

export function SettlementForm({
  getTogetherId,
  people,
  participantIds,
  initialFromId = null,
  initialToId = null,
  initialAmountInt = 0,
}: SettlementFormProps) {
  const db = useSQLiteContext();
  const [fromId, setFromId] = useState<PersonId | null>(initialFromId ?? participantIds[0] ?? null);
  const [toId, setToId] = useState<PersonId | null>(
    initialToId ?? participantIds.find((pid) => pid !== (initialFromId ?? participantIds[0])) ?? null
  );
  const [amountText, setAmountText] = useState(
    initialAmountInt > 0 ? groupDigits(String(initialAmountInt)) : ''
  );
  const [saving, setSaving] = useState(false);

  const amountInt = parseAmountToInt(amountText);
  const onAmountChange = (text: string) => setAmountText(groupDigits(text.replace(/\D/g, '')));

  const participants = participantIds
    .map((personId) => people.find((person) => person.id === personId))
    .filter((person): person is Person => person != null);

  const submit = async () => {
    if (!fromId) {
      Alert.alert('Sin pagador', 'Elegí quién puso la plata.');
      return;
    }
    if (!toId) {
      Alert.alert('Sin destinatario', 'Elegí quién recibió la plata.');
      return;
    }
    if (fromId === toId) {
      Alert.alert('Persona repetida', 'Quien paga y quien recibe deben ser distintos.');
      return;
    }
    if (amountInt <= 0) {
      Alert.alert('Monto inválido', 'Ingresá un monto mayor a cero.');
      return;
    }
    setSaving(true);
    try {
      await createSettlement(db, { getTogetherId, fromId, toId, amountInt });
      router.back();
    } catch {
      Alert.alert('Error', 'No se pudo registrar el pago.');
      setSaving(false);
    }
  };

  if (participants.length < 2) {
    return (
      <Screen>
        <EmptyState
          icon="alert-circle-outline"
          message="Esta juntada necesita al menos dos participantes."
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
          keyboardType="number-pad"
          label="Monto ($)"
          onChangeText={onAmountChange}
          placeholder="0"
          value={amountText}
        />
        {amountInt > 0 ? <Text style={styles.amountPreview}>{formatMoney(amountInt)}</Text> : null}

        <SectionTitle style={styles.section} title="¿Quién puso la plata?" />
        <View style={styles.chipsRow}>
          {participants.map((person) => (
            <Chip
              key={person.id}
              label={person.name}
              onPress={() => setFromId(person.id)}
              selected={fromId === person.id}
            />
          ))}
        </View>

        <SectionTitle style={styles.section} title="¿Quién la recibió?" />
        <View style={styles.chipsRow}>
          {participants.map((person) => (
            <Chip
              key={person.id}
              label={person.name}
              onPress={() => setToId(person.id)}
              selected={toId === person.id}
            />
          ))}
        </View>
        <Text style={styles.hint}>El pago se descuenta de las liquidaciones pendientes.</Text>
      </ScrollView>
      <View style={styles.footer}>
        <Button loading={saving} onPress={submit} title="Registrar pago" />
      </View>
    </Screen>
  );
}

export function SettlementFormLoading() {
  return (
    <Screen>
      <View style={styles.loading}>
        <ActivityIndicator color={colors.primary} size="large" />
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

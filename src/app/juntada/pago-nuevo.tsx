import { useCallback, useState } from 'react';
import { StyleSheet } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import { GetTogether } from '@/domain/get-togethers/get-together-types';
import { Person } from '@/domain/people/person-types';
import { getGetTogether } from '@/infrastructure/persistence/get-togethers-repository';
import { listAllPeople } from '@/infrastructure/persistence/people-repository';
import { Button } from '@/ui/components/Button';
import { EmptyState } from '@/ui/components/EmptyState';
import { Screen } from '@/ui/components/Screen';
import { SettlementForm, SettlementFormLoading } from '@/ui/expenses/SettlementForm';
import { spacing } from '@/ui/theme';

export default function NuevoPagoScreen() {
  const db = useSQLiteContext();
  const { id, fromId, toId, amount } = useLocalSearchParams<{
    id: string;
    fromId?: string;
    toId?: string;
    amount?: string;
  }>();
  const [getTogether, setGetTogether] = useState<GetTogether | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [ready, setReady] = useState(false);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const [getTogetherResult, allPeople] = await Promise.all([
          getGetTogether(db, id),
          listAllPeople(db),
        ]);
        setGetTogether(getTogetherResult);
        setPeople(allPeople);
        setReady(true);
      })().catch(() => setReady(true));
    }, [db, id])
  );

  if (!ready) return <SettlementFormLoading />;

  if (!getTogether) {
    return (
      <Screen>
        <EmptyState
          icon="alert-circle-outline"
          message="No pudimos cargar esta juntada."
          title="Juntada no encontrada"
        >
          <Button onPress={() => router.back()} style={styles.emptyButton} title="Volver" variant="secondary" />
        </EmptyState>
      </Screen>
    );
  }

  const amountInt = amount ? parseInt(amount, 10) : 0;

  return (
    <SettlementForm
      getTogetherId={getTogether.id}
      initialAmountInt={Number.isFinite(amountInt) ? amountInt : 0}
      initialFromId={fromId ?? null}
      initialToId={toId ?? null}
      participantIds={getTogether.participantIds}
      people={people}
    />
  );
}

const styles = StyleSheet.create({
  emptyButton: {
    marginTop: spacing.lg,
  },
});

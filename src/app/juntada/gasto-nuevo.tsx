import { useCallback, useState } from 'react';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import { GetTogether } from '@/domain/get-togethers/get-together-types';
import { Person } from '@/domain/people/person-types';
import { getGetTogether } from '@/infrastructure/persistence/get-togethers-repository';
import { listAllPeople } from '@/infrastructure/persistence/people-repository';
import { Button } from '@/ui/components/Button';
import { EmptyState } from '@/ui/components/EmptyState';
import { Screen } from '@/ui/components/Screen';
import { ExpenseForm, ExpenseFormLoading } from '@/ui/expenses/ExpenseForm';

export default function NuevoGastoScreen() {
  const db = useSQLiteContext();
  const { id } = useLocalSearchParams<{ id: string }>();
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

  if (!ready) return <ExpenseFormLoading />;

  if (!getTogether) {
    return (
      <Screen>
        <EmptyState
          icon="alert-circle-outline"
          title="Juntada no encontrada"
          message="No pudimos cargar esta juntada."
        >
          <Button onPress={() => router.back()} title="Volver" variant="secondary" />
        </EmptyState>
      </Screen>
    );
  }

  return <ExpenseForm getTogether={getTogether} people={people} />;
}

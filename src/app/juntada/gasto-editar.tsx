import { useCallback, useState } from 'react';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import { Expense } from '@/domain/expenses/expense-types';
import { GetTogether } from '@/domain/get-togethers/get-together-types';
import { Person } from '@/domain/people/person-types';
import { getExpense } from '@/infrastructure/persistence/expenses-repository';
import { getGetTogether } from '@/infrastructure/persistence/get-togethers-repository';
import { listAllPeople } from '@/infrastructure/persistence/people-repository';
import { Button } from '@/ui/components/Button';
import { EmptyState } from '@/ui/components/EmptyState';
import { Screen } from '@/ui/components/Screen';
import { ExpenseForm, ExpenseFormLoading } from '@/ui/expenses/ExpenseForm';

export default function EditarGastoScreen() {
  const db = useSQLiteContext();
  const { id, expenseId } = useLocalSearchParams<{ id: string; expenseId: string }>();
  const [getTogether, setGetTogether] = useState<GetTogether | null>(null);
  const [expense, setExpense] = useState<Expense | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [ready, setReady] = useState(false);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const [getTogetherResult, expenseResult, allPeople] = await Promise.all([
          getGetTogether(db, id),
          getExpense(db, expenseId),
          listAllPeople(db),
        ]);
        setGetTogether(getTogetherResult);
        setExpense(expenseResult);
        setPeople(allPeople);
        setReady(true);
      })().catch(() => setReady(true));
    }, [db, id, expenseId])
  );

  if (!ready) return <ExpenseFormLoading />;

  if (!getTogether || !expense) {
    return (
      <Screen>
        <EmptyState
          icon="alert-circle-outline"
          title="Gasto no encontrado"
          message="No pudimos cargar este gasto."
        >
          <Button onPress={() => router.back()} title="Volver" variant="secondary" />
        </EmptyState>
      </Screen>
    );
  }

  return (
    <ExpenseForm
      expenseId={expense.id}
      getTogether={getTogether}
      initialAmountInt={expense.amountInt}
      initialDescription={expense.description}
      initialParticipantIds={expense.participantIds}
      initialPayerId={expense.payerId}
      people={people}
    />
  );
}

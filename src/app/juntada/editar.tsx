import { useCallback, useState } from 'react';
import { Alert, StyleSheet } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import { findExpensePayers, sameParticipants } from '@/domain/get-togethers/get-together-edits';
import { GetTogether } from '@/domain/get-togethers/get-together-types';
import { Person, PersonId } from '@/domain/people/person-types';
import { listExpenses } from '@/infrastructure/persistence/expenses-repository';
import {
  getGetTogether,
  updateGetTogether,
} from '@/infrastructure/persistence/get-togethers-repository';
import { GroupWithMembers, listGroups } from '@/infrastructure/persistence/groups-repository';
import { listPeople } from '@/infrastructure/persistence/people-repository';
import { hasSettlements } from '@/infrastructure/persistence/settlements-repository';
import { Button } from '@/ui/components/Button';
import { EmptyState } from '@/ui/components/EmptyState';
import { Screen } from '@/ui/components/Screen';
import {
  GetTogetherForm,
  GetTogetherFormLoading,
  GetTogetherInput,
} from '@/ui/get-togethers/GetTogetherForm';
import { useDiscardGuard } from '@/ui/get-togethers/useDiscardGuard';
import { spacing } from '@/ui/theme';

export default function EditarJuntadaScreen() {
  const db = useSQLiteContext();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [getTogether, setGetTogether] = useState<GetTogether | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [groups, setGroups] = useState<GroupWithMembers[]>([]);
  const [expenseCount, setExpenseCount] = useState(0);
  const [lockedParticipantIds, setLockedParticipantIds] = useState<PersonId[]>([]);
  const [hasPayments, setHasPayments] = useState(false);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const load = useCallback(async () => {
    if (!id) {
      setReady(true);
      return;
    }
    const [getTogetherResult, peopleResult, groupsResult, expensesResult, paymentsResult] =
      await Promise.all([
        getGetTogether(db, id),
        listPeople(db),
        listGroups(db),
        listExpenses(db, id),
        hasSettlements(db, id),
      ]);
    setGetTogether(getTogetherResult);
    setPeople(peopleResult);
    setGroups(groupsResult);
    setExpenseCount(expensesResult.length);
    setLockedParticipantIds([...findExpensePayers(expensesResult)]);
    setHasPayments(paymentsResult);
    setReady(true);
  }, [db, id]);

  useFocusEffect(
    useCallback(() => {
      load().catch(() => setReady(true));
    }, [load])
  );

  const disableDiscardGuard = useDiscardGuard(dirty);

  const persist = async (updateExpenses: boolean, input: GetTogetherInput) => {
    if (!getTogether || saving) return;
    setSaving(true);
    try {
      await updateGetTogether(db, getTogether.id, {
        name: input.name,
        participantIds: input.participantIds,
        updateExpenses,
      });
      setDirty(false);
      disableDiscardGuard();
      router.back();
    } catch {
      Alert.alert('Error', 'No se pudo guardar la juntada.');
      setSaving(false);
    }
  };

  const submit = (input: GetTogetherInput) => {
    if (!getTogether) return;
    const participantsChanged = !sameParticipants(getTogether.participantIds, input.participantIds);
    if (!participantsChanged || expenseCount === 0) {
      void persist(false, input);
      return;
    }
    if (hasPayments) {
      Alert.alert(
        'Participantes actualizados',
        'Hay pagos registrados, así que los gastos existentes no se pueden actualizar. El cambio solo aplica a gastos nuevos.',
        [{ text: 'Entendido', onPress: () => void persist(false, input) }]
      );
      return;
    }
    Alert.alert('Gastos existentes', '¿Querés actualizar también los gastos ya cargados?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Solo gastos nuevos', onPress: () => void persist(false, input) },
      { text: 'Actualizar gastos', onPress: () => void persist(true, input) },
    ]);
  };

  if (!ready) return <GetTogetherFormLoading />;

  if (!getTogether) {
    return (
      <Screen>
        <EmptyState
          icon="alert-circle-outline"
          message="No pudimos encontrar esta juntada."
          title="Juntada no encontrada"
        >
          <Button onPress={() => router.back()} style={styles.emptyButton} title="Volver" variant="secondary" />
        </EmptyState>
      </Screen>
    );
  }

  return (
    <GetTogetherForm
      date={getTogether.date}
      groups={groups}
      initialName={getTogether.name}
      initialParticipantIds={getTogether.participantIds}
      lockedParticipantIds={lockedParticipantIds}
      onDirtyChange={setDirty}
      onPeopleChanged={load}
      onSubmit={submit}
      people={people}
      saving={saving}
      submitLabel="Guardar cambios"
    />
  );
}

const styles = StyleSheet.create({
  emptyButton: {
    marginTop: spacing.lg,
  },
});

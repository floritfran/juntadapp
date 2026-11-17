import { useCallback, useMemo, useState } from 'react';
import { Alert } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import dayjs from 'dayjs';

import { Person } from '@/domain/people/person-types';
import { createGetTogether } from '@/infrastructure/persistence/get-togethers-repository';
import { GroupWithMembers, listGroups } from '@/infrastructure/persistence/groups-repository';
import { listPeople } from '@/infrastructure/persistence/people-repository';
import {
  GetTogetherForm,
  GetTogetherFormLoading,
  GetTogetherInput,
} from '@/ui/get-togethers/GetTogetherForm';

export default function NuevaJuntadaScreen() {
  const db = useSQLiteContext();
  const today = useMemo(() => dayjs().startOf('day').toDate(), []);
  const [people, setPeople] = useState<Person[]>([]);
  const [groups, setGroups] = useState<GroupWithMembers[]>([]);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const [peopleResult, groupsResult] = await Promise.all([listPeople(db), listGroups(db)]);
    setPeople(peopleResult);
    setGroups(groupsResult);
    setReady(true);
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      load().catch(() => setReady(true));
    }, [load])
  );

  const submit = async (input: GetTogetherInput) => {
    if (saving) return;
    setSaving(true);
    try {
      const getTogether = await createGetTogether(db, {
        name: input.name,
        date: today,
        participantIds: input.participantIds,
      });
      router.replace(`/juntada/${getTogether.id}`);
    } catch {
      Alert.alert('Error', 'No se pudo crear la juntada.');
      setSaving(false);
    }
  };

  if (!ready) return <GetTogetherFormLoading />;

  return (
    <GetTogetherForm
      date={today}
      groups={groups}
      onPeopleChanged={load}
      onSubmit={submit}
      people={people}
      saving={saving}
      submitLabel="Crear juntada"
    />
  );
}

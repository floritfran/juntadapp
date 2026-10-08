import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import dayjs from 'dayjs';

import { Person } from '@/domain/people/person-types';
import { GroupWithMembers, listGroups } from '@/infrastructure/persistence/groups-repository';
import { createGetTogether } from '@/infrastructure/persistence/get-togethers-repository';
import { createPerson, listPeople } from '@/infrastructure/persistence/people-repository';
import { Button } from '@/ui/components/Button';
import { CheckRow } from '@/ui/components/CheckRow';
import { Chip } from '@/ui/components/Chip';
import { EmptyState } from '@/ui/components/EmptyState';
import { Screen } from '@/ui/components/Screen';
import { SectionTitle } from '@/ui/components/SectionTitle';
import { TextField } from '@/ui/components/TextField';
import { formatDate } from '@/ui/format';
import { colors, fontSize, spacing } from '@/ui/theme';

export default function NuevaJuntadaScreen() {
  const db = useSQLiteContext();
  const [people, setPeople] = useState<Person[]>([]);
  const [groups, setGroups] = useState<GroupWithMembers[]>([]);
  const [ready, setReady] = useState(false);
  const [name, setName] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [showNewPerson, setShowNewPerson] = useState(false);
  const [newPersonName, setNewPersonName] = useState('');
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

  const togglePerson = (personId: string) => {
    setSelectedGroupId(null);
    setSelectedIds((ids) =>
      ids.includes(personId) ? ids.filter((id) => id !== personId) : [...ids, personId]
    );
  };

  const applyGroup = (group: GroupWithMembers) => {
    if (selectedGroupId === group.id) {
      setSelectedGroupId(null);
      setSelectedIds([]);
    } else {
      setSelectedGroupId(group.id);
      setSelectedIds(group.memberIds);
    }
  };

  const addPerson = async () => {
    const trimmed = newPersonName.trim();
    if (!trimmed) return;
    try {
      const person = await createPerson(db, trimmed);
      await load();
      setSelectedGroupId(null);
      setSelectedIds((ids) => [...ids, person.id]);
      setNewPersonName('');
      setShowNewPerson(false);
    } catch {
      Alert.alert('Error', 'No se pudo crear la persona.');
    }
  };

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      Alert.alert('Falta el nombre', 'Poné un nombre para la juntada.');
      return;
    }
    if (selectedIds.length === 0) {
      Alert.alert('Sin participantes', 'Elegí al menos un participante.');
      return;
    }
    setSaving(true);
    try {
      const getTogether = await createGetTogether(db, {
        name: trimmed,
        date: dayjs().startOf('day').toDate(),
        participantIds: selectedIds,
      });
      router.replace(`/juntada/${getTogether.id}`);
    } catch {
      Alert.alert('Error', 'No se pudo crear la juntada.');
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

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <TextField
          autoCapitalize="sentences"
          label="Nombre"
          onChangeText={setName}
          placeholder="Ej: Asado en casa de Juan"
          value={name}
        />
        <View style={styles.dateRow}>
          <Text style={styles.dateLabel}>Fecha</Text>
          <Text style={styles.dateValue}>{formatDate(new Date())}</Text>
        </View>

        {groups.length > 0 ? (
          <>
            <SectionTitle style={styles.section} title="Cargar desde un grupo" />
            <View style={styles.chipsRow}>
              {groups.map((group) => (
                <Chip
                  key={group.id}
                  label={`${group.name} (${group.members.length})`}
                  onPress={() => applyGroup(group)}
                  selected={selectedGroupId === group.id}
                />
              ))}
            </View>
          </>
        ) : null}

        <SectionTitle style={styles.section} title="Participantes" />
        {people.length === 0 ? (
          <EmptyState
            icon="person-outline"
            message="Necesitás cargar personas antes de crear una juntada."
            title="Sin personas"
          >
            <Button
              onPress={() => router.push('/grupos')}
              style={styles.emptyButton}
              title="Ir a Grupos"
              variant="secondary"
            />
          </EmptyState>
        ) : (
          <>
            {people.map((person) => (
              <CheckRow
                checked={selectedIds.includes(person.id)}
                key={person.id}
                label={person.name}
                onToggle={() => togglePerson(person.id)}
              />
            ))}
            {showNewPerson ? (
              <View style={styles.newPerson}>
                <TextField
                  autoCapitalize="words"
                  label="Otra persona"
                  onChangeText={setNewPersonName}
                  onSubmitEditing={addPerson}
                  placeholder="Nombre"
                  returnKeyType="done"
                  value={newPersonName}
                />
                <View style={styles.newPersonActions}>
                  <Button
                    disabled={!newPersonName.trim()}
                    onPress={addPerson}
                    style={styles.flex}
                    title="Agregar"
                  />
                  <Button
                    onPress={() => {
                      setShowNewPerson(false);
                      setNewPersonName('');
                    }}
                    style={styles.flex}
                    title="Cancelar"
                    variant="secondary"
                  />
                </View>
              </View>
            ) : (
              <Button
                onPress={() => setShowNewPerson(true)}
                style={styles.addPersonButton}
                title="+ Otra persona"
                variant="secondary"
              />
            )}
            <Text style={styles.counter}>
              {selectedIds.length === 1
                ? '1 participante seleccionado'
                : `${selectedIds.length} participantes seleccionados`}
            </Text>
          </>
        )}
      </ScrollView>
      <View style={styles.footer}>
        <Button disabled={people.length === 0} loading={saving} onPress={submit} title="Crear juntada" />
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
  dateRow: {
    alignItems: 'center',
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
    minHeight: 52,
    paddingHorizontal: spacing.lg,
  },
  dateLabel: {
    color: colors.textMuted,
    fontSize: fontSize.md,
    fontWeight: '600',
  },
  dateValue: {
    color: colors.text,
    fontSize: fontSize.lg,
    fontWeight: '600',
  },
  section: {
    marginTop: spacing.md,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  emptyButton: {
    marginTop: spacing.lg,
  },
  addPersonButton: {
    marginTop: spacing.md,
  },
  newPerson: {
    marginTop: spacing.md,
  },
  newPersonActions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  counter: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    marginTop: spacing.sm,
  },
  footer: {
    backgroundColor: colors.bg,
    padding: spacing.lg,
  },
  flex: {
    flex: 1,
  },
});

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import { matchesQuery } from '@/domain/common/text-search';
import { findPersonWithName } from '@/domain/people/person-name';
import { Person, PersonId } from '@/domain/people/person-types';
import { GroupWithMembers } from '@/infrastructure/persistence/groups-repository';
import { createPerson } from '@/infrastructure/persistence/people-repository';
import { Button } from '@/ui/components/Button';
import { CheckRow } from '@/ui/components/CheckRow';
import { Chip } from '@/ui/components/Chip';
import { EmptyState } from '@/ui/components/EmptyState';
import { Screen } from '@/ui/components/Screen';
import { SearchField } from '@/ui/components/SearchField';
import { SectionTitle } from '@/ui/components/SectionTitle';
import { TextField } from '@/ui/components/TextField';
import { formatDate } from '@/ui/format';
import { fontSize, spacing, useColors, type Colors } from '@/ui/theme';

export interface GetTogetherInput {
  name: string;
  participantIds: PersonId[];
}

interface GetTogetherFormProps {
  people: Person[];
  groups: GroupWithMembers[];
  date: Date;
  initialName?: string;
  initialParticipantIds?: PersonId[];
  submitLabel: string;
  saving?: boolean;
  onSubmit: (input: GetTogetherInput) => void | Promise<void>;
  onDirtyChange?: (dirty: boolean) => void;
  onPeopleChanged?: () => void | Promise<void>;
  lockedParticipantIds?: PersonId[];
}

const NO_IDS: PersonId[] = [];

export function GetTogetherForm({
  people,
  groups,
  date,
  initialName = '',
  initialParticipantIds = NO_IDS,
  submitLabel,
  saving = false,
  onSubmit,
  onDirtyChange,
  onPeopleChanged,
  lockedParticipantIds = NO_IDS,
}: GetTogetherFormProps) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const db = useSQLiteContext();
  const [name, setName] = useState(initialName);
  const [selectedIds, setSelectedIds] = useState<PersonId[]>(initialParticipantIds);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [showNewPerson, setShowNewPerson] = useState(false);
  const [newPersonName, setNewPersonName] = useState('');
  const [savingPerson, setSavingPerson] = useState(false);
  const [personQuery, setPersonQuery] = useState('');

  const filteredPeople = useMemo(
    () => people.filter((person) => matchesQuery(person.name, personQuery)),
    [people, personQuery]
  );

  const activePersonIds = useMemo(() => new Set(people.map((person) => person.id)), [people]);
  const lockedIds = useMemo(() => new Set(lockedParticipantIds), [lockedParticipantIds]);

  const dirty = useMemo(() => {
    if (name.trim() !== initialName.trim()) return true;
    if (selectedIds.length !== initialParticipantIds.length) return true;
    const initial = new Set(initialParticipantIds);
    return selectedIds.some((id) => !initial.has(id));
  }, [name, selectedIds, initialName, initialParticipantIds]);

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  const togglePerson = useCallback(
    (personId: PersonId) => {
      if (lockedIds.has(personId)) return;
      setSelectedGroupId(null);
      setSelectedIds((ids) =>
        ids.includes(personId) ? ids.filter((id) => id !== personId) : [...ids, personId]
      );
    },
    [lockedIds]
  );

  const applyGroup = (group: GroupWithMembers) => {
    if (selectedGroupId === group.id) {
      setSelectedGroupId(null);
      setSelectedIds([...lockedParticipantIds]);
    } else {
      setSelectedGroupId(group.id);
      const members = group.memberIds.filter((personId) => activePersonIds.has(personId));
      setSelectedIds([...new Set([...lockedParticipantIds, ...members])]);
    }
  };

  const addPerson = async () => {
    if (savingPerson) return;
    const trimmed = newPersonName.trim();
    if (!trimmed) return;
    const duplicate = findPersonWithName(people, trimmed);
    if (duplicate) {
      Alert.alert('Persona duplicada', `Ya existe "${duplicate.name}".`);
      return;
    }
    setSavingPerson(true);
    try {
      const person = await createPerson(db, trimmed);
      await onPeopleChanged?.();
      setSelectedGroupId(null);
      setSelectedIds((ids) => [...ids, person.id]);
      setNewPersonName('');
      setShowNewPerson(false);
    } catch {
      Alert.alert('Error', 'No se pudo crear la persona.');
    } finally {
      setSavingPerson(false);
    }
  };

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      Alert.alert('Falta el nombre', 'Poné un nombre para la juntada.');
      return;
    }
    if (selectedIds.length === 0) {
      Alert.alert('Sin participantes', 'Elegí al menos un participante.');
      return;
    }
    if (lockedParticipantIds.some((id) => !selectedIds.includes(id))) {
      Alert.alert(
        'Participantes con gastos',
        'No se puede quitar a quien pagó un gasto de la juntada.'
      );
      return;
    }
    void onSubmit({ name: trimmed, participantIds: selectedIds });
  };

  return (
    <Screen>
      <FlatList
        contentContainerStyle={styles.content}
        data={people.length === 0 ? [] : filteredPeople}
        keyExtractor={(person) => person.id}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        ListFooterComponent={
          people.length > 0 ? (
            <>
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
                      disabled={!newPersonName.trim() || savingPerson}
                      loading={savingPerson}
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
          ) : undefined
        }
        ListHeaderComponent={
          <>
            <TextField
              autoCapitalize="sentences"
              label="Nombre"
              onChangeText={setName}
              placeholder="Ej: Asado en casa de Juan"
              value={name}
            />
            <View style={styles.dateRow}>
              <Text style={styles.dateLabel}>Fecha</Text>
              <Text style={styles.dateValue}>{formatDate(date)}</Text>
            </View>

            {groups.length > 0 ? (
              <>
                <SectionTitle style={styles.section} title="Cargar desde un grupo" />
                <View style={styles.chipsRow}>
                  {groups.map((group) => (
                    <Chip
                      key={group.id}
                      label={`${group.name} (${
                        group.memberIds.filter((personId) => activePersonIds.has(personId)).length
                      })`}
                      onPress={() => applyGroup(group)}
                      selected={selectedGroupId === group.id}
                    />
                  ))}
                </View>
              </>
            ) : null}

            <SectionTitle style={styles.section} title="Participantes" />
            {lockedIds.size > 0 ? (
              <Text style={styles.lockedHint}>
                Quienes pagaron gastos no se pueden quitar.
              </Text>
            ) : null}
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
                <SearchField onChangeText={setPersonQuery} value={personQuery} />
                {filteredPeople.length === 0 ? (
                  <EmptyState
                    icon="search-outline"
                    message="Probá con otro nombre."
                    title="No se encontraron personas"
                  />
                ) : null}
              </>
            )}
          </>
        }
        renderItem={({ item: person }) => (
          <CheckRow
            checked={selectedIds.includes(person.id)}
            disabled={lockedIds.has(person.id)}
            label={person.name}
            onToggle={() => togglePerson(person.id)}
          />
        )}
        style={styles.list}
      />
      <View style={styles.footer}>
        <Button disabled={people.length === 0} loading={saving} onPress={submit} title={submitLabel} />
      </View>
    </Screen>
  );
}

export function GetTogetherFormLoading() {
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
  lockedHint: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    marginTop: spacing.xs,
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

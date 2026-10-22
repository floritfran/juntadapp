import { Ionicons } from '@expo/vector-icons';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import { matchesQuery } from '@/domain/common/text-search';
import { GroupId } from '@/domain/groups/group-types';
import { Person, PersonId } from '@/domain/people/person-types';
import {
  GroupWithMembers,
  createGroup,
  listGroups,
  softDeleteGroup,
  updateGroup,
} from '@/infrastructure/persistence/groups-repository';
import {
  createPerson,
  listPeople,
  softDeletePerson,
  updatePerson,
} from '@/infrastructure/persistence/people-repository';
import { Button } from '@/ui/components/Button';
import { Card } from '@/ui/components/Card';
import { CheckRow } from '@/ui/components/CheckRow';
import { EmptyState } from '@/ui/components/EmptyState';
import { Screen } from '@/ui/components/Screen';
import { SearchField } from '@/ui/components/SearchField';
import { SectionTitle } from '@/ui/components/SectionTitle';
import { TextField } from '@/ui/components/TextField';
import { fontSize, radius, spacing, useColors, type Colors } from '@/ui/theme';

export default function GruposScreen() {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const db = useSQLiteContext();
  const [people, setPeople] = useState<Person[]>([]);
  const [groups, setGroups] = useState<GroupWithMembers[]>([]);
  const [ready, setReady] = useState(false);
  const [newPersonName, setNewPersonName] = useState('');
  const [groupName, setGroupName] = useState('');
  const [groupMemberIds, setGroupMemberIds] = useState<string[]>([]);
  const [savingGroup, setSavingGroup] = useState(false);
  const [editingPersonId, setEditingPersonId] = useState<PersonId | null>(null);
  const [editingPersonName, setEditingPersonName] = useState('');
  const [editingGroupId, setEditingGroupId] = useState<GroupId | null>(null);
  const [editingGroupName, setEditingGroupName] = useState('');
  const [editingGroupMemberIds, setEditingGroupMemberIds] = useState<PersonId[]>([]);
  const [savingEdit, setSavingEdit] = useState(false);
  const [personQuery, setPersonQuery] = useState('');

  const filteredPeople = useMemo(
    () => people.filter((person) => matchesQuery(person.name, personQuery)),
    [people, personQuery]
  );

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

  const addPerson = async () => {
    const name = newPersonName.trim();
    if (!name) return;
    try {
      await createPerson(db, name);
      setNewPersonName('');
      await load();
    } catch {
      Alert.alert('Error', 'No se pudo agregar la persona.');
    }
  };

  const cancelEditPerson = () => {
    setEditingPersonId(null);
    setEditingPersonName('');
  };

  const cancelEditGroup = () => {
    setEditingGroupId(null);
    setEditingGroupName('');
    setEditingGroupMemberIds([]);
  };

  const startEditPerson = (person: Person) => {
    cancelEditGroup();
    setEditingPersonId(person.id);
    setEditingPersonName(person.name);
  };

  const startEditGroup = (group: GroupWithMembers) => {
    cancelEditPerson();
    setEditingGroupId(group.id);
    setEditingGroupName(group.name);
    setEditingGroupMemberIds([...group.memberIds]);
  };

  const confirmDeletePerson = (person: Person) =>
    Alert.alert('Eliminar persona', `¿Eliminar a ${person.name}?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          if (editingPersonId === person.id) cancelEditPerson();
          await softDeletePerson(db, person.id);
          await load();
        },
      },
    ]);

  const confirmDeleteGroup = (group: GroupWithMembers) =>
    Alert.alert('Eliminar grupo', `¿Eliminar el grupo "${group.name}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          if (editingGroupId === group.id) cancelEditGroup();
          await softDeleteGroup(db, group.id);
          await load();
        },
      },
    ]);

  const submitEditPerson = async () => {
    const name = editingPersonName.trim();
    if (!name || !editingPersonId) return;
    setSavingEdit(true);
    try {
      await updatePerson(db, editingPersonId, name);
      cancelEditPerson();
      await load();
    } catch {
      Alert.alert('Error', 'No se pudo editar la persona.');
    } finally {
      setSavingEdit(false);
    }
  };

  const toggleEditingGroupMember = (personId: PersonId) =>
    setEditingGroupMemberIds((ids) =>
      ids.includes(personId) ? ids.filter((id) => id !== personId) : [...ids, personId]
    );

  const submitEditGroup = async () => {
    const name = editingGroupName.trim();
    if (!name || !editingGroupId) return;
    if (editingGroupMemberIds.length === 0) {
      Alert.alert('Sin integrantes', 'Elegí al menos un integrante.');
      return;
    }
    setSavingEdit(true);
    try {
      await updateGroup(db, editingGroupId, { name, memberIds: editingGroupMemberIds });
      cancelEditGroup();
      await load();
    } catch {
      Alert.alert('Error', 'No se pudo editar el grupo.');
    } finally {
      setSavingEdit(false);
    }
  };

  const toggleMember = (personId: string) =>
    setGroupMemberIds((ids) =>
      ids.includes(personId) ? ids.filter((id) => id !== personId) : [...ids, personId]
    );

  const submitGroup = async () => {
    const name = groupName.trim();
    if (!name) {
      Alert.alert('Falta el nombre', 'Poné un nombre para el grupo.');
      return;
    }
    if (groupMemberIds.length === 0) {
      Alert.alert('Sin integrantes', 'Elegí al menos un integrante.');
      return;
    }
    setSavingGroup(true);
    try {
      await createGroup(db, { name, memberIds: groupMemberIds });
      setGroupName('');
      setGroupMemberIds([]);
      await load();
    } catch {
      Alert.alert('Error', 'No se pudo crear el grupo.');
    } finally {
      setSavingGroup(false);
    }
  };

  if (!ready) {
    return (
      <Screen bottomInset={false}>
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      </Screen>
    );
  }

  return (
    <Screen bottomInset={false}>
      <ScrollView contentContainerStyle={styles.content}>
        <SectionTitle title="Personas" />
        <TextField
          autoCapitalize="words"
          label={editingPersonId ? 'Nombre' : 'Nueva persona'}
          onChangeText={editingPersonId ? setEditingPersonName : setNewPersonName}
          onSubmitEditing={editingPersonId ? submitEditPerson : addPerson}
          placeholder="Nombre"
          returnKeyType="done"
          value={editingPersonId ? editingPersonName : newPersonName}
        />
        {editingPersonId ? (
          <>
            <Button
              disabled={!editingPersonName.trim()}
              loading={savingEdit}
              onPress={submitEditPerson}
              style={styles.blockButton}
              title="Guardar cambios"
            />
            <Button
              disabled={savingEdit}
              onPress={cancelEditPerson}
              style={styles.blockButton}
              title="Cancelar"
              variant="secondary"
            />
          </>
        ) : (
          <Button
            disabled={!newPersonName.trim()}
            onPress={addPerson}
            style={styles.blockButton}
            title="Agregar persona"
            variant="secondary"
          />
        )}
        {people.length === 0 ? (
          <EmptyState
            icon="person-outline"
            message="Cargá a tus amigos para poder usarlos en juntadas y grupos."
            title="Sin personas"
          />
        ) : (
          <>
            <SearchField onChangeText={setPersonQuery} value={personQuery} />
            {filteredPeople.length === 0 ? (
              <EmptyState
                icon="search-outline"
                message="Probá con otro nombre."
                title="No se encontraron personas"
              />
            ) : (
              filteredPeople.map((person) => (
                <View key={person.id} style={styles.personRow}>
                  <Text numberOfLines={1} style={styles.personName}>
                    {person.name}
                  </Text>
                  <View style={styles.rowIcons}>
                    <Pressable
                      hitSlop={8}
                      onPress={() => startEditPerson(person)}
                      style={styles.iconButton}
                    >
                      <Ionicons color={colors.primary} name="create-outline" size={20} />
                    </Pressable>
                    <Pressable
                      hitSlop={8}
                      onPress={() => confirmDeletePerson(person)}
                      style={styles.iconButton}
                    >
                      <Ionicons color={colors.danger} name="trash-outline" size={20} />
                    </Pressable>
                  </View>
                </View>
              ))
            )}
          </>
        )}

        <SectionTitle style={styles.section} title="Grupos" />
        {groups.length === 0 ? (
          <EmptyState
            icon="people-outline"
            message='Creá grupos frecuentes como "Los pibes" o "Fútbol" para cargarlos en un toque.'
            title="Sin grupos"
          />
        ) : (
          groups.map((group) => (
            <Card key={group.id} style={styles.groupCard}>
              <View style={styles.groupHeader}>
                <Text numberOfLines={1} style={styles.groupName}>
                  {group.name}
                </Text>
                <View style={styles.rowIcons}>
                  <Pressable
                    hitSlop={8}
                    onPress={() => startEditGroup(group)}
                    style={styles.iconButton}
                  >
                    <Ionicons color={colors.primary} name="create-outline" size={20} />
                  </Pressable>
                  <Pressable
                    hitSlop={8}
                    onPress={() => confirmDeleteGroup(group)}
                    style={styles.iconButton}
                  >
                    <Ionicons color={colors.danger} name="trash-outline" size={20} />
                  </Pressable>
                </View>
              </View>
              <Text style={styles.groupMembers}>
                {group.members.length > 0
                  ? group.members.map((member) => member.name).join(', ')
                  : 'Sin integrantes'}
              </Text>
            </Card>
          ))
        )}

        <SectionTitle style={styles.section} title={editingGroupId ? 'Editar grupo' : 'Nuevo grupo'} />
        <TextField
          autoCapitalize="words"
          label="Nombre del grupo"
          onChangeText={editingGroupId ? setEditingGroupName : setGroupName}
          placeholder="Ej: Los pibes"
          value={editingGroupId ? editingGroupName : groupName}
        />
        <Text style={styles.fieldLabel}>Integrantes</Text>
        {people.length === 0 ? (
          <Text style={styles.hint}>Primero agregá personas arriba.</Text>
        ) : filteredPeople.length === 0 ? (
          <Text style={styles.hint}>No se encontraron personas.</Text>
        ) : (
          filteredPeople.map((person) => (
            <CheckRow
              checked={
                editingGroupId
                  ? editingGroupMemberIds.includes(person.id)
                  : groupMemberIds.includes(person.id)
              }
              key={person.id}
              label={person.name}
              onToggle={() =>
                editingGroupId ? toggleEditingGroupMember(person.id) : toggleMember(person.id)
              }
            />
          ))
        )}
        {editingGroupId ? (
          <>
            <Button
              disabled={!editingGroupName.trim() || editingGroupMemberIds.length === 0}
              loading={savingEdit}
              onPress={submitEditGroup}
              style={styles.blockButton}
              title="Guardar cambios"
            />
            <Button
              disabled={savingEdit}
              onPress={cancelEditGroup}
              style={styles.blockButton}
              title="Cancelar"
              variant="secondary"
            />
          </>
        ) : (
          <Button
            disabled={!groupName.trim() || groupMemberIds.length === 0}
            loading={savingGroup}
            onPress={submitGroup}
            style={styles.blockButton}
            title="Crear grupo"
          />
        )}
      </ScrollView>
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
  blockButton: {
    marginBottom: spacing.lg,
  },
  section: {
    marginTop: spacing.xl,
  },
  personRow: {
    alignItems: 'center',
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
    minHeight: 52,
    paddingLeft: spacing.lg,
    paddingRight: spacing.md,
  },
  personName: {
    color: colors.text,
    flex: 1,
    fontSize: fontSize.lg,
  },
  iconButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    minWidth: 44,
  },
  rowIcons: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  groupCard: {
    marginBottom: spacing.md,
  },
  groupHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  groupName: {
    color: colors.text,
    flex: 1,
    fontSize: fontSize.lg,
    fontWeight: '700',
    marginRight: spacing.sm,
  },
  groupMembers: {
    color: colors.textMuted,
    fontSize: fontSize.md,
    lineHeight: 21,
    marginTop: spacing.xs,
  },
  fieldLabel: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    fontWeight: '600',
    marginBottom: spacing.xs + 2,
    textTransform: 'uppercase',
  },
  hint: {
    color: colors.textMuted,
    fontSize: fontSize.md,
    marginBottom: spacing.md,
  },
});

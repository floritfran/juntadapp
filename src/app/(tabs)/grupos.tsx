import { Ionicons } from '@expo/vector-icons';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import { Person } from '@/domain/people/person-types';
import {
  GroupWithMembers,
  createGroup,
  listGroups,
  softDeleteGroup,
} from '@/infrastructure/persistence/groups-repository';
import { createPerson, listPeople, softDeletePerson } from '@/infrastructure/persistence/people-repository';
import { Button } from '@/ui/components/Button';
import { Card } from '@/ui/components/Card';
import { CheckRow } from '@/ui/components/CheckRow';
import { EmptyState } from '@/ui/components/EmptyState';
import { Screen } from '@/ui/components/Screen';
import { SectionTitle } from '@/ui/components/SectionTitle';
import { TextField } from '@/ui/components/TextField';
import { colors, fontSize, radius, spacing } from '@/ui/theme';

export default function GruposScreen() {
  const db = useSQLiteContext();
  const [people, setPeople] = useState<Person[]>([]);
  const [groups, setGroups] = useState<GroupWithMembers[]>([]);
  const [ready, setReady] = useState(false);
  const [newPersonName, setNewPersonName] = useState('');
  const [groupName, setGroupName] = useState('');
  const [groupMemberIds, setGroupMemberIds] = useState<string[]>([]);
  const [savingGroup, setSavingGroup] = useState(false);

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

  const confirmDeletePerson = (person: Person) =>
    Alert.alert('Eliminar persona', `¿Eliminar a ${person.name}?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
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
          await softDeleteGroup(db, group.id);
          await load();
        },
      },
    ]);

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
        <SectionTitle title="Personas" />
        <TextField
          autoCapitalize="words"
          label="Nueva persona"
          onChangeText={setNewPersonName}
          onSubmitEditing={addPerson}
          placeholder="Nombre"
          returnKeyType="done"
          value={newPersonName}
        />
        <Button
          disabled={!newPersonName.trim()}
          onPress={addPerson}
          style={styles.blockButton}
          title="Agregar persona"
          variant="secondary"
        />
        {people.length === 0 ? (
          <EmptyState
            icon="person-outline"
            message="Cargá a tus amigos para poder usarlos en juntadas y grupos."
            title="Sin personas"
          />
        ) : (
          people.map((person) => (
            <View key={person.id} style={styles.personRow}>
              <Text numberOfLines={1} style={styles.personName}>
                {person.name}
              </Text>
              <Pressable
                hitSlop={8}
                onPress={() => confirmDeletePerson(person)}
                style={styles.iconButton}
              >
                <Ionicons color={colors.danger} name="trash-outline" size={20} />
              </Pressable>
            </View>
          ))
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
                <Pressable
                  hitSlop={8}
                  onPress={() => confirmDeleteGroup(group)}
                  style={styles.iconButton}
                >
                  <Ionicons color={colors.danger} name="trash-outline" size={20} />
                </Pressable>
              </View>
              <Text style={styles.groupMembers}>
                {group.members.length > 0
                  ? group.members.map((member) => member.name).join(', ')
                  : 'Sin integrantes'}
              </Text>
            </Card>
          ))
        )}

        <SectionTitle style={styles.section} title="Nuevo grupo" />
        <TextField
          autoCapitalize="words"
          label="Nombre del grupo"
          onChangeText={setGroupName}
          placeholder="Ej: Los pibes"
          value={groupName}
        />
        <Text style={styles.fieldLabel}>Integrantes</Text>
        {people.length === 0 ? (
          <Text style={styles.hint}>Primero agregá personas arriba.</Text>
        ) : (
          people.map((person) => (
            <CheckRow
              checked={groupMemberIds.includes(person.id)}
              key={person.id}
              label={person.name}
              onToggle={() => toggleMember(person.id)}
            />
          ))
        )}
        <Button
          disabled={!groupName.trim() || groupMemberIds.length === 0}
          loading={savingGroup}
          onPress={submitGroup}
          style={styles.blockButton}
          title="Crear grupo"
        />
      </ScrollView>
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

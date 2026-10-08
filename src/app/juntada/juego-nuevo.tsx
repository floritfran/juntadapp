import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import { GAME_LABELS, GameId, TrucoTeam, TrucoTeamSize } from '@/domain/games/game-types';
import { validateTrucoTeamSetup } from '@/domain/games/truco/truco-scorer';
import { GroupWithMembers, listGroups } from '@/infrastructure/persistence/groups-repository';
import { getGetTogether } from '@/infrastructure/persistence/get-togethers-repository';
import { createMatch } from '@/infrastructure/persistence/matches-repository';
import { listAllPeople } from '@/infrastructure/persistence/people-repository';
import { Person } from '@/domain/people/person-types';
import { Button } from '@/ui/components/Button';
import { CheckRow } from '@/ui/components/CheckRow';
import { Chip } from '@/ui/components/Chip';
import { EmptyState } from '@/ui/components/EmptyState';
import { Screen } from '@/ui/components/Screen';
import { SectionTitle } from '@/ui/components/SectionTitle';
import { colors, fontSize, spacing } from '@/ui/theme';

const GAMES: GameId[] = ['truco', 'generala', 'skull-king'];
const TEAM_SIZES: TrucoTeamSize[] = [1, 2, 3];

function defaultTeams(ids: string[], teamSize: TrucoTeamSize): Record<string, TrucoTeam> {
  const teams: Record<string, TrucoTeam> = {};
  ids.forEach((id, index) => {
    teams[id] = index < teamSize ? 1 : 2;
  });
  return teams;
}

export default function NuevaPartidaScreen() {
  const db = useSQLiteContext();
  const { id, game: gameParam } = useLocalSearchParams<{ id: string; game?: string }>();
  const [people, setPeople] = useState<Person[]>([]);
  const [groups, setGroups] = useState<GroupWithMembers[]>([]);
  const [ready, setReady] = useState(false);
  const [game, setGame] = useState<GameId>(
    GAMES.includes(gameParam as GameId) ? (gameParam as GameId) : 'truco'
  );
  const [teamSize, setTeamSize] = useState<TrucoTeamSize>(2);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [teamByPerson, setTeamByPerson] = useState<Record<string, TrucoTeam>>({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const [peopleResult, groupsResult, getTogether] = await Promise.all([
      listAllPeople(db),
      listGroups(db),
      id ? getGetTogether(db, id) : Promise.resolve(null),
    ]);
    setPeople(peopleResult);
    setGroups(groupsResult);
    if (getTogether) {
      setSelectedIds(getTogether.participantIds);
      setTeamByPerson(defaultTeams(getTogether.participantIds, 2));
    }
    setReady(true);
  }, [db, id]);

  useFocusEffect(
    useCallback(() => {
      load().catch(() => setReady(true));
    }, [load])
  );

  const applySelection = (ids: string[]) => {
    setSelectedIds(ids);
    setTeamByPerson(defaultTeams(ids, teamSize));
  };

  const togglePerson = (personId: string) => {
    setSelectedGroupId(null);
    applySelection(
      selectedIds.includes(personId)
        ? selectedIds.filter((id_) => id_ !== personId)
        : [...selectedIds, personId]
    );
  };

  const applyGroup = (group: GroupWithMembers) => {
    if (selectedGroupId === group.id) {
      setSelectedGroupId(null);
      applySelection([]);
    } else {
      setSelectedGroupId(group.id);
      applySelection(group.memberIds);
    }
  };

  const changeTeamSize = (size: TrucoTeamSize) => {
    setTeamSize(size);
    setTeamByPerson(defaultTeams(selectedIds, size));
  };

  const toggleTeam = (personId: string) => {
    setTeamByPerson((current) => ({
      ...current,
      [personId]: current[personId] === 1 ? 2 : 1,
    }));
  };

  const team1Count = selectedIds.filter((personId) => teamByPerson[personId] === 1).length;
  const team2Count = selectedIds.length - team1Count;
  const expectedPlayers = teamSize * 2;

  const submit = async () => {
    if (selectedIds.length === 0) {
      Alert.alert('Sin jugadores', 'Elegí al menos dos jugadores.');
      return;
    }
    if (game === 'generala' && selectedIds.length < 2) {
      Alert.alert('Sin jugadores', 'La Generala necesita al menos 2 jugadores.');
      return;
    }
    if (game === 'skull-king' && selectedIds.length < 2) {
      Alert.alert('Sin jugadores', 'Skull King necesita al menos 2 jugadores.');
      return;
    }
    if (game === 'truco') {
      try {
        validateTrucoTeamSetup(
          selectedIds.map((personId) => ({ personId, team: teamByPerson[personId] ?? 1 })),
          teamSize
        );
      } catch {
        Alert.alert(
          'Equipos incompletos',
          `Para el truco ${teamSize}v${teamSize} necesitás ${expectedPlayers} jugadores: ${teamSize} en cada equipo.`
        );
        return;
      }
    }
    setSaving(true);
    try {
      const match = await createMatch(db, {
        getTogetherId: id ?? '',
        game,
        teamSize: game === 'truco' ? teamSize : null,
        players: selectedIds.map((personId) => ({
          personId,
          team: game === 'truco' ? (teamByPerson[personId] ?? 1) : null,
        })),
      });
      router.replace({ pathname: '/juntada/partida', params: { match: match.id } });
    } catch {
      Alert.alert('Error', 'No se pudo crear la partida.');
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
        <SectionTitle title="Juego" />
        <View style={styles.chipsRow}>
          {GAMES.map((value) => (
            <Chip
              key={value}
              label={GAME_LABELS[value]}
              onPress={() => setGame(value)}
              selected={game === value}
            />
          ))}
        </View>

        {game === 'truco' ? (
          <>
            <SectionTitle style={styles.section} title="Formato" />
            <View style={styles.chipsRow}>
              {TEAM_SIZES.map((size) => (
                <Chip
                  key={size}
                  label={`${size}v${size}`}
                  onPress={() => changeTeamSize(size)}
                  selected={teamSize === size}
                />
              ))}
            </View>
          </>
        ) : null}

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

        <SectionTitle style={styles.section} title="Jugadores" />
        {people.length === 0 ? (
          <EmptyState
            icon="person-outline"
            message="Necesitás cargar personas antes de empezar una partida."
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
            <Text style={styles.counter}>
              {selectedIds.length === 1
                ? '1 jugador seleccionado'
                : `${selectedIds.length} jugadores seleccionados`}
            </Text>
          </>
        )}

        {game === 'truco' && selectedIds.length > 0 ? (
          <>
            <SectionTitle style={styles.section} title="Equipos" />
            <Text style={styles.teamCounter}>
              Equipo A: {team1Count} · Equipo B: {team2Count} {team1Count === team2Count ? '✓' : ''}
            </Text>
            {selectedIds.map((personId) => {
              const person = people.find((value) => value.id === personId);
              const team = teamByPerson[personId] ?? 1;
              return (
                <View key={personId} style={styles.teamRow}>
                  <Text numberOfLines={1} style={[styles.teamName, styles.flex]}>
                    {person?.name ?? 'Persona'}
                  </Text>
                  <Chip label="Equipo A" onPress={() => toggleTeam(personId)} selected={team === 1} />
                  <Chip label="Equipo B" onPress={() => toggleTeam(personId)} selected={team === 2} />
                </View>
              );
            })}
          </>
        ) : null}
      </ScrollView>
      <View style={styles.footer}>
        <Button disabled={people.length === 0} loading={saving} onPress={submit} title="Iniciar partida" />
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
  section: {
    marginTop: spacing.md,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  counter: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    marginTop: spacing.sm,
  },
  teamCounter: {
    color: colors.text,
    fontSize: fontSize.md,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  teamRow: {
    alignItems: 'center',
    flexDirection: 'row',
    marginBottom: spacing.sm,
  },
  teamName: {
    color: colors.text,
    fontSize: fontSize.md,
    marginRight: spacing.sm,
  },
  emptyButton: {
    marginTop: spacing.lg,
  },
  footer: {
    backgroundColor: colors.bg,
    padding: spacing.lg,
  },
  flex: {
    flex: 1,
  },
});

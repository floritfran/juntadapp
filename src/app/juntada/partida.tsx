import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import { GAME_LABELS, Match, MatchStatus } from '@/domain/games/game-types';
import { getMatch } from '@/infrastructure/persistence/matches-repository';
import { listAllPeople } from '@/infrastructure/persistence/people-repository';
import { Button } from '@/ui/components/Button';
import { Card } from '@/ui/components/Card';
import { EmptyState } from '@/ui/components/EmptyState';
import { Screen } from '@/ui/components/Screen';
import { formatDate } from '@/ui/format';
import { GeneralaScorer } from '@/ui/games/GeneralaScorer';
import { SkullKingScorer } from '@/ui/games/SkullKingScorer';
import { TrucoScorer } from '@/ui/games/TrucoScorer';
import { colors, fontSize, spacing } from '@/ui/theme';

export default function PartidaScreen() {
  const db = useSQLiteContext();
  const { match: matchId } = useLocalSearchParams<{ match: string }>();
  const [match, setMatch] = useState<Match | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [nameById, setNameById] = useState<Map<string, string>>(new Map());

  const load = useCallback(async () => {
    if (!matchId) {
      setNotFound(true);
      return;
    }
    try {
      const [matchResult, people] = await Promise.all([getMatch(db, matchId), listAllPeople(db)]);
      const names = new Map<string, string>();
      people.forEach((person) => names.set(person.id, person.name));
      setNameById(names);
      if (!matchResult) {
        setNotFound(true);
      } else {
        setMatch(matchResult);
      }
    } catch {
      setNotFound(true);
    }
  }, [db, matchId]);

  useFocusEffect(
    useCallback(() => {
      load().catch(() => setNotFound(true));
    }, [load])
  );

const nameOf = (personId: string) => nameById.get(personId) ?? 'Persona eliminada';

  const handleStatusChange = useCallback(
    (status: MatchStatus) => setMatch((current) => (current ? { ...current, status } : current)),
    []
  );

  if (notFound) {
    return (
      <Screen>
        <EmptyState
          icon="alert-circle-outline"
          message="No pudimos encontrar esta partida."
          title="Partida no encontrada"
        >
          <Button onPress={() => router.back()} style={styles.emptyButton} title="Volver" variant="secondary" />
        </EmptyState>
      </Screen>
    );
  }

  if (!match) {
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
        <Card style={styles.header}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>{GAME_LABELS[match.game]}</Text>
            <View style={[styles.badge, match.status === 'finished' ? styles.badgeDone : styles.badgeActive]}>
              <Text style={[styles.badgeText, match.status === 'finished' ? styles.badgeTextDone : styles.badgeTextActive]}>
                {match.status === 'finished' ? 'Finalizada' : 'En curso'}
              </Text>
            </View>
          </View>
          <Text style={styles.meta}>
            {formatDate(match.createdAt)} · {match.players.length} jugadores
          </Text>
          <Text style={styles.players}>
            {match.players.map((player) => nameOf(player.personId)).join(' · ')}
          </Text>
        </Card>

        {match.game === 'truco' ? <TrucoScorer key={match.id} match={match} nameOf={nameOf} onStatusChange={handleStatusChange} /> : null}
        {match.game === 'generala' ? <GeneralaScorer key={match.id} match={match} nameOf={nameOf} onStatusChange={handleStatusChange} /> : null}
        {match.game === 'skull-king' ? <SkullKingScorer key={match.id} match={match} nameOf={nameOf} onStatusChange={handleStatusChange} /> : null}
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
  header: {
    marginBottom: spacing.md,
    padding: spacing.md,
  },
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  title: {
    color: colors.text,
    fontSize: fontSize.xl,
    fontWeight: '700',
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  badgeActive: {
    backgroundColor: colors.primarySoft,
  },
  badgeDone: {
    backgroundColor: '#E5E7EB',
  },
  badgeText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  badgeTextActive: {
    color: colors.primary,
  },
  badgeTextDone: {
    color: colors.textMuted,
  },
  meta: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    marginTop: spacing.xs,
  },
  players: {
    color: colors.text,
    fontSize: fontSize.md,
    fontWeight: '600',
    marginTop: spacing.xs,
  },
  emptyButton: {
    marginTop: spacing.lg,
  },
});

import { Ionicons } from '@expo/vector-icons';
import { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import { GAME_LABELS, Match, TrucoTeam } from '@/domain/games/game-types';
import { computeTrucoScore } from '@/domain/games/truco/truco-scorer';
import { computeGeneralaTotals, generalaWinners } from '@/domain/games/generala/generala-scorer';
import { skullKingTotals } from '@/domain/games/skull-king/skull-king-scorer';
import { listGeneralaEntries } from '@/infrastructure/persistence/generala-repository';
import { deleteMatch, listMatches } from '@/infrastructure/persistence/matches-repository';
import { listAllPeople } from '@/infrastructure/persistence/people-repository';
import { listSkullKingEntries } from '@/infrastructure/persistence/skull-king-repository';
import { listTrucoRounds } from '@/infrastructure/persistence/truco-repository';
import { Button } from '@/ui/components/Button';
import { Card } from '@/ui/components/Card';
import { EmptyState } from '@/ui/components/EmptyState';
import { colors, fontSize, spacing } from '@/ui/theme';

interface Props {
  getTogetherId: string;
}

interface MatchCardData {
  match: Match;
  summary: string;
}

function teamLabel(team: TrucoTeam): string {
  return team === 1 ? 'Equipo A' : 'Equipo B';
}

export function GamesSection({ getTogetherId }: Props) {
  const db = useSQLiteContext();
  const [cards, setCards] = useState<MatchCardData[] | null>(null);
  const [nameById, setNameById] = useState<Map<string, string>>(new Map());

  const load = useCallback(async () => {
    try {
      const [matches, people] = await Promise.all([listMatches(db, getTogetherId), listAllPeople(db)]);
      const names = new Map<string, string>();
      people.forEach((person) => names.set(person.id, person.name));
      setNameById(names);
      const localNameOf = (personId: string) => names.get(personId) ?? 'Persona eliminada';

      const cardData: MatchCardData[] = [];
      for (const match of matches) {
        cardData.push({ match, summary: await summarize(db, match, localNameOf) });
      }
      setCards(cardData);
    } catch {
      setCards([]);
    }
  }, [db, getTogetherId]);

  useFocusEffect(
    useCallback(() => {
      load().catch(() => setCards([]));
    }, [load])
  );

  const nameOf = (personId: string) => nameById.get(personId) ?? 'Persona eliminada';

  const confirmDelete = (match: Match) =>
    Alert.alert('Eliminar partida', `¿Eliminar la partida de ${GAME_LABELS[match.game]}?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          await deleteMatch(db, match.id);
          await load();
        },
      },
    ]);

  if (cards === null) return null;

  return (
    <View>
      <View style={styles.header}>
        <Button
          onPress={() => router.push({ pathname: '/juntada/juego-nuevo', params: { id: getTogetherId } })}
          style={styles.newButton}
          title="+ Nueva partida"
          variant="secondary"
        />
      </View>

      {cards.length === 0 ? (
        <EmptyState
          icon="game-controller-outline"
          message="Elegí Truco, Generala o Skull King y cargá los jugadores para empezar."
          title="Sin partidas todavía"
        />
      ) : (
        cards.map(({ match, summary }) => (
          <Pressable
            key={match.id}
            onPress={() => router.push({ pathname: '/juntada/partida', params: { match: match.id } })}
          >
            <Card style={styles.matchCard}>
              <View style={styles.matchRow}>
                <View style={styles.flex}>
                  <View style={styles.titleRow}>
                    <Text style={styles.game}>{GAME_LABELS[match.game]}</Text>
                    <View
                      style={[styles.badge, match.status === 'finished' ? styles.badgeDone : styles.badgeActive]}
                    >
                      <Text
                        style={[styles.badgeText, match.status === 'finished' ? styles.badgeTextDone : styles.badgeTextActive]}
                      >
                        {match.status === 'finished' ? 'Finalizada' : 'En curso'}
                      </Text>
                    </View>
                  </View>
                  <Text numberOfLines={1} style={styles.players}>
                    {match.players.map((player) => nameOf(player.personId)).join(' · ')}
                  </Text>
                  <Text style={styles.summary}>{summary}</Text>
                </View>
                <Pressable hitSlop={8} onPress={() => confirmDelete(match)} style={styles.iconButton}>
                  <Ionicons color={colors.danger} name="trash-outline" size={20} />
                </Pressable>
              </View>
            </Card>
          </Pressable>
        ))
      )}
    </View>
  );
}

async function summarize(
  db: ReturnType<typeof useSQLiteContext>,
  match: Match,
  nameOf: (personId: string) => string
): Promise<string> {
  if (match.game === 'truco') {
    const rounds = await listTrucoRounds(db, match.id);
    const score = computeTrucoScore(rounds);
    const line = `${teamLabel(1)} ${score.team1} · ${teamLabel(2)} ${score.team2}`;
    if (match.status === 'finished') {
      const winner: TrucoTeam = score.team1 >= score.team2 ? 1 : 2;
      return `Ganó ${teamLabel(winner)} · ${line}`;
    }
    return line;
  }
  if (match.game === 'generala') {
    const entries = await listGeneralaEntries(db, match.id);
    const order = match.players.map((player) => player.personId);
    const entriesByPlayer = groupByPlayer(entries);
    const allComplete =
      order.length > 0 && order.every((personId) => (entriesByPlayer[personId] ?? []).length === 11);
    if (allComplete) {
      const winners = generalaWinners(order, entriesByPlayer);
      const best = Math.max(
        ...winners.map((personId) => computeGeneralaTotals(entriesByPlayer[personId] ?? []).total)
      );
      const who = winners.map(nameOf).join(' y ');
      return `${winners.length > 1 ? 'Empataron' : 'Ganó'} ${who} · ${best} pts`;
    }
    return `${entries.length}/${order.length * 11} casilleros cargados`;
  }
  const entries = await listSkullKingEntries(db, match.id);
  const totals = skullKingTotals(entries);
  const line = totals.map((row) => `${nameOf(row.personId)} ${row.total}`).join(' · ');
  if (match.status === 'finished' && totals.length > 0) {
    return `Ganó ${nameOf(totals[0].personId)} · ${line}`;
  }
  const currentRound = new Set(entries.map((entry) => entry.round)).size + 1;
  return `Ronda ${Math.min(currentRound, 10)}/10 · ${line}`;
}

function groupByPlayer<T extends { personId: string }>(entries: T[]): Record<string, T[]> {
  const map: Record<string, T[]> = {};
  for (const entry of entries) {
    (map[entry.personId] ??= []).push(entry);
  }
  return map;
}

const styles = StyleSheet.create({
  header: {
    marginBottom: spacing.md,
  },
  newButton: {
    minHeight: 44,
  },
  matchCard: {
    marginBottom: spacing.sm,
    padding: spacing.md,
  },
  matchRow: {
    flexDirection: 'row',
  },
  titleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  game: {
    color: colors.text,
    fontSize: fontSize.lg,
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
  players: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    marginTop: 2,
  },
  summary: {
    color: colors.text,
    fontSize: fontSize.md,
    fontWeight: '600',
    marginTop: spacing.xs,
  },
  iconButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    minWidth: 44,
  },
  flex: {
    flex: 1,
  },
});

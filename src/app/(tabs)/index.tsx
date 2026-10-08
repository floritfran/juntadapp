import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import {
  GetTogetherSummary,
  listGetTogethers,
} from '@/infrastructure/persistence/get-togethers-repository';
import { Button } from '@/ui/components/Button';
import { Card } from '@/ui/components/Card';
import { EmptyState } from '@/ui/components/EmptyState';
import { Screen } from '@/ui/components/Screen';
import { formatDate, formatMoney } from '@/ui/format';
import { colors, fontSize, spacing } from '@/ui/theme';

export default function JuntadasScreen() {
  const db = useSQLiteContext();
  const [items, setItems] = useState<GetTogetherSummary[] | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      listGetTogethers(db)
        .then((data) => {
          if (active) setItems(data);
        })
        .catch(() => {
          if (active) setItems([]);
        });
      return () => {
        active = false;
      };
    }, [db])
  );

  return (
    <Screen>
      {items === null ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <FlatList
          contentContainerStyle={styles.list}
          data={items}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={
            <EmptyState
              icon="calendar-outline"
              message="Creá la primera para empezar a dividir gastos."
              title="No hay juntadas"
            />
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push(`/juntada/${item.id}`)}
              style={({ pressed }) => [pressed && styles.pressed]}
            >
              <Card style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text numberOfLines={1} style={styles.name}>
                    {item.name}
                  </Text>
                  {item.status === 'closed' ? (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>Cerrada</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={styles.meta}>
                  {formatDate(item.date)} ·{' '}
                  {item.participantIds.length === 1
                    ? '1 participante'
                    : `${item.participantIds.length} participantes`}
                </Text>
                <Text style={styles.total}>
                  {item.totalSpent > 0 ? formatMoney(item.totalSpent) : 'Sin gastos'}
                </Text>
              </Card>
            </Pressable>
          )}
        />
      )}
      <View style={styles.footer}>
        <Button onPress={() => router.push('/juntada/nueva')} title="+ Nueva juntada" />
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
  list: {
    padding: spacing.lg,
    paddingBottom: 120,
    flexGrow: 1,
  },
  pressed: {
    opacity: 0.85,
  },
  card: {
    marginBottom: spacing.md,
  },
  cardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  name: {
    color: colors.text,
    flex: 1,
    fontSize: fontSize.xl,
    fontWeight: '700',
    marginRight: spacing.sm,
  },
  badge: {
    backgroundColor: colors.primarySoft,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  badgeText: {
    color: colors.primary,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  meta: {
    color: colors.textMuted,
    fontSize: fontSize.md,
    marginTop: spacing.xs,
  },
  total: {
    color: colors.text,
    fontSize: fontSize.lg,
    fontWeight: '600',
    marginTop: spacing.sm,
  },
  footer: {
    backgroundColor: colors.bg,
    bottom: 0,
    left: 0,
    padding: spacing.lg,
    position: 'absolute',
    right: 0,
  },
});

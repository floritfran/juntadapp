import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import { compareByName, matchesQuery } from '@/domain/common/text-search';
import {
  filterGetTogethers,
  hasActiveGetTogetherFilters,
  type GetTogetherFilters,
} from '@/domain/get-togethers/get-together-filters';
import { Person, PersonId } from '@/domain/people/person-types';
import {
  GetTogetherSummary,
  listGetTogethers,
} from '@/infrastructure/persistence/get-togethers-repository';
import { listAllPeople } from '@/infrastructure/persistence/people-repository';
import { Button } from '@/ui/components/Button';
import { Card } from '@/ui/components/Card';
import { CheckRow } from '@/ui/components/CheckRow';
import { Chip } from '@/ui/components/Chip';
import { EmptyState } from '@/ui/components/EmptyState';
import { MonthPicker } from '@/ui/components/MonthPicker';
import { Screen } from '@/ui/components/Screen';
import { SearchField } from '@/ui/components/SearchField';
import { SectionTitle } from '@/ui/components/SectionTitle';
import { formatDate, formatMoney } from '@/ui/format';
import { fontSize, radius, spacing, useColors, type Colors } from '@/ui/theme';

export default function JuntadasScreen() {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const db = useSQLiteContext();
  const [items, setItems] = useState<GetTogetherSummary[] | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [query, setQuery] = useState('');
  const [month, setMonth] = useState<string | null>(null);
  const [participantIds, setParticipantIds] = useState<PersonId[]>([]);
  const [personQuery, setPersonQuery] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      Promise.all([listGetTogethers(db), listAllPeople(db)])
        .then(([getTogethers, allPeople]) => {
          if (active) {
            setItems(getTogethers);
            setPeople(allPeople);
          }
        })
        .catch(() => {
          if (active) {
            setItems([]);
            setPeople([]);
          }
        });
      return () => {
        active = false;
      };
    }, [db])
  );

  const filters: GetTogetherFilters = useMemo(
    () => ({ query, month, participantIds }),
    [query, month, participantIds]
  );
  const filteredItems = useMemo(
    () => (items === null ? null : filterGetTogethers(items, filters)),
    [items, filters]
  );
  const hasFilters = hasActiveGetTogetherFilters(filters);
  const activeFilterCount =
    (filters.query.trim() === '' ? 0 : 1) + (filters.month === null ? 0 : 1) + filters.participantIds.length;

  const participantOptions = useMemo(
    () => [...people].sort((a, b) => compareByName(a.name, b.name)),
    [people]
  );
  const filteredParticipants = useMemo(
    () => participantOptions.filter((person) => matchesQuery(person.name, personQuery)),
    [participantOptions, personQuery]
  );

  const clearFilters = () => {
    setQuery('');
    setMonth(null);
    setParticipantIds([]);
    setPersonQuery('');
  };

  const toggleParticipant = (personId: PersonId) =>
    setParticipantIds((current) =>
      current.includes(personId) ? current.filter((id) => id !== personId) : [...current, personId]
    );

  const listHeader = (
    <View style={styles.filters}>
      <SearchField
        label="Buscar juntada"
        onChangeText={setQuery}
        placeholder="Nombre de la juntada"
        value={query}
      />
      <View style={styles.filterRow}>
        <Chip
          label={activeFilterCount > 0 ? `Filtros (${activeFilterCount})` : 'Filtros'}
          onPress={() => setFiltersOpen((open) => !open)}
          selected={filtersOpen || activeFilterCount > 0}
        />
        {hasFilters ? (
          <Button onPress={clearFilters} style={styles.clearButton} title="Limpiar" variant="secondary" />
        ) : null}
      </View>
      {filtersOpen ? (
        <View style={styles.filterPanel}>
          <SectionTitle style={styles.filterTitle} title="Fecha" />
          <MonthPicker onChange={setMonth} value={month} />
          <SectionTitle style={styles.filterTitle} title="Integrantes" />
          <SearchField
            label="Buscar integrante"
            onChangeText={setPersonQuery}
            placeholder="Nombre del integrante"
            value={personQuery}
          />
          <FlatList
            contentContainerStyle={styles.peopleListContent}
            data={filteredParticipants}
            extraData={participantIds}
            keyExtractor={(person) => person.id}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <Text style={styles.hint}>
                {people.length === 0
                  ? 'Todavía no hay integrantes.'
                  : 'No hay integrantes con ese nombre.'}
              </Text>
            }
            nestedScrollEnabled
            renderItem={({ item }) => (
              <CheckRow
                checked={participantIds.includes(item.id)}
                label={item.name}
                onToggle={() => toggleParticipant(item.id)}
              />
            )}
            style={styles.peopleList}
          />
          <Text style={styles.hint}>
            Se muestran las juntadas en las que participaron todos los seleccionados.
          </Text>
        </View>
      ) : null}
    </View>
  );

  return (
    <Screen bottomInset={false}>
      {filteredItems === null ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <FlatList
          contentContainerStyle={styles.list}
          data={filteredItems}
          keyExtractor={(item) => item.id}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            items?.length === 0 ? (
              <EmptyState
                icon="calendar-outline"
                message="Creá la primera para empezar a dividir gastos."
                title="No hay juntadas"
              />
            ) : (
              <EmptyState
                icon="search-outline"
                message="Probá con otra búsqueda o quitá los filtros."
                title="No se encontraron juntadas"
              >
                <Button
                  onPress={clearFilters}
                  style={styles.emptyButton}
                  title="Limpiar filtros"
                  variant="secondary"
                />
              </EmptyState>
            )
          }
          ListHeaderComponent={listHeader}
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

const makeStyles = (colors: Colors) => StyleSheet.create({
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
  filters: {
    marginBottom: spacing.md,
  },
  filterRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  clearButton: {
    minHeight: 44,
  },
  filterPanel: {
    marginTop: spacing.sm,
  },
  filterTitle: {
    fontSize: fontSize.lg,
    marginTop: spacing.sm,
  },
  peopleList: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    height: 220,
    marginBottom: spacing.sm,
    overflow: 'hidden',
    paddingHorizontal: spacing.md,
  },
  peopleListContent: {
    paddingVertical: spacing.xs,
  },
  hint: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    lineHeight: 18,
    marginBottom: spacing.sm,
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
  emptyButton: {
    marginTop: spacing.lg,
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

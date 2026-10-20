import { Ionicons } from '@expo/vector-icons';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import {
  calculateBalances,
  calculateDirectTransfers,
  minimizeTransfers,
} from '@/domain/expenses/expense-calculator';
import { Expense, Settlement, Transfer } from '@/domain/expenses/expense-types';
import { buildSettlementSummaryText } from '@/domain/expenses/settlement-summary';
import { GetTogether } from '@/domain/get-togethers/get-together-types';
import { Person, PersonId } from '@/domain/people/person-types';
import { listExpenses, softDeleteExpense } from '@/infrastructure/persistence/expenses-repository';
import { getGetTogether } from '@/infrastructure/persistence/get-togethers-repository';
import { listAllPeople } from '@/infrastructure/persistence/people-repository';
import { listSettlements, softDeleteSettlement } from '@/infrastructure/persistence/settlements-repository';
import { Button } from '@/ui/components/Button';
import { Card } from '@/ui/components/Card';
import { Chip } from '@/ui/components/Chip';
import { EmptyState } from '@/ui/components/EmptyState';
import { Screen } from '@/ui/components/Screen';
import { SectionTitle } from '@/ui/components/SectionTitle';
import { formatDate, formatMoney } from '@/ui/format';
import { GamesSection } from '@/ui/games/GamesSection';
import { colors, fontSize, radius, spacing } from '@/ui/theme';

type SettlementMode = 'min' | 'direct';
type DetailTab = 'expenses' | 'games';

export default function JuntadaDetailScreen() {
  const db = useSQLiteContext();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [getTogether, setGetTogether] = useState<GetTogether | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [notFound, setNotFound] = useState(false);
  const [mode, setMode] = useState<SettlementMode>('min');
  const [tab, setTab] = useState<DetailTab>('expenses');

  const load = useCallback(async () => {
    if (!id) {
      setNotFound(true);
      return;
    }
    try {
      const [getTogetherResult, expenseRows, settlementRows, allPeople] = await Promise.all([
        getGetTogether(db, id),
        listExpenses(db, id),
        listSettlements(db, id),
        listAllPeople(db),
      ]);
      setGetTogether(getTogetherResult);
      setExpenses(expenseRows);
      setSettlements(settlementRows);
      setPeople(allPeople);
      if (!getTogetherResult) setNotFound(true);
    } catch {
      setNotFound(true);
    }
  }, [db, id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const nameById = useMemo(() => {
    const map = new Map<PersonId, string>();
    people.forEach((person) => map.set(person.id, person.name));
    return map;
  }, [people]);

  const nameOf = (personId: PersonId) => nameById.get(personId) ?? 'Persona eliminada';

  const total = useMemo(() => expenses.reduce((sum, expense) => sum + expense.amountInt, 0), [expenses]);
  const balances = useMemo(() => calculateBalances(expenses, settlements), [expenses, settlements]);
  const transfers = useMemo(
    () =>
      mode === 'min'
        ? minimizeTransfers(expenses, settlements)
        : calculateDirectTransfers(expenses, settlements),
    [mode, expenses, settlements]
  );
  const hasDebts = balances.some((balance) => balance.net !== 0);

  const confirmDeleteExpense = (expense: Expense) =>
    Alert.alert('Eliminar gasto', `¿Eliminar "${expense.description}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          await softDeleteExpense(db, expense.id);
          await load();
        },
      },
    ]);

  const confirmDeleteSettlement = (settlement: Settlement) =>
    Alert.alert(
      'Eliminar pago',
      `¿Eliminar el pago de ${nameOf(settlement.fromId)} a ${nameOf(settlement.toId)}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            await softDeleteSettlement(db, settlement.id);
            await load();
          },
        },
      ]
    );

  const settleTransfer = (transfer: Transfer) =>
    router.push({
      pathname: '/juntada/pago-nuevo',
      params: {
        id: id ?? '',
        fromId: transfer.from,
        toId: transfer.to,
        amount: String(transfer.amount),
      },
    });

  const shareSettlement = async () => {
    if (!getTogether) return;
    const text = buildSettlementSummaryText({
      title: getTogether.name,
      totalInt: total,
      transfers: transfers.map((transfer) => ({
        fromName: nameOf(transfer.from),
        toName: nameOf(transfer.to),
        amount: transfer.amount,
      })),
    });
    try {
      await Share.share({ message: text });
    } catch {
      // Share cancelled or unavailable; nothing to do.
    }
  };

  if (notFound) {
    return (
      <Screen>
        <EmptyState
          icon="alert-circle-outline"
          message="No pudimos encontrar esta juntada."
          title="Juntada no encontrada"
        >
          <Button onPress={() => router.back()} style={styles.emptyButton} title="Volver" variant="secondary" />
        </EmptyState>
      </Screen>
    );
  }

  if (!getTogether) {
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
        <Card>
          <View style={styles.headerRow}>
            <Text numberOfLines={2} style={styles.title}>
              {getTogether.name}
            </Text>
            {getTogether.status === 'closed' ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>Cerrada</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.meta}>
            {formatDate(getTogether.date)} ·{' '}
            {getTogether.participantIds.length === 1
              ? '1 participante'
              : `${getTogether.participantIds.length} participantes`}
          </Text>
          <View style={styles.chipsRow}>
            {getTogether.participantIds.map((personId) => (
              <Chip key={personId} label={nameOf(personId)} />
            ))}
          </View>
        </Card>

        <View style={styles.segment}>
          <Pressable
            onPress={() => setTab('expenses')}
            style={[styles.segmentItem, tab === 'expenses' && styles.segmentItemActive]}
          >
            <Text style={[styles.segmentLabel, tab === 'expenses' && styles.segmentLabelActive]}>
              Gastos
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setTab('games')}
            style={[styles.segmentItem, tab === 'games' && styles.segmentItemActive]}
          >
            <Text style={[styles.segmentLabel, tab === 'games' && styles.segmentLabelActive]}>
              Juegos
            </Text>
          </Pressable>
        </View>

        {tab === 'games' ? (
          <GamesSection getTogetherId={id ?? ''} />
        ) : (
          <>
            <View style={styles.sectionRow}>
              <SectionTitle style={styles.flex} title="Gastos" />
              <Button
                onPress={() =>
                  router.push({ pathname: '/juntada/gasto-nuevo', params: { id: id ?? '' } })
                }
                style={styles.newExpenseButton}
                title="+ Nuevo"
                variant="secondary"
              />
            </View>
            <Text style={styles.total}>Total gastado: {formatMoney(total)}</Text>

            {expenses.length === 0 ? (
              <EmptyState
                icon="receipt-outline"
                message="Cuando cargues gastos vas a ver acá el resumen."
                title="Sin gastos"
              />
            ) : (
              expenses.map((expense) => (
                <Card key={expense.id} style={styles.expenseCard}>
                  <View style={styles.expenseRow}>
                    <View style={styles.flex}>
                      <Text numberOfLines={1} style={styles.expenseDescription}>
                        {expense.description}
                      </Text>
                      <Text style={styles.expenseMeta}>
                        Pagó {nameOf(expense.payerId)} ·{' '}
                        {expense.participantIds.length === 1
                          ? '1 persona'
                          : `${expense.participantIds.length} personas`}
                      </Text>
                    </View>
                    <Text style={styles.expenseAmount}>{formatMoney(expense.amountInt)}</Text>
                    <Pressable
                      hitSlop={8}
                      onPress={() =>
                        router.push({
                          pathname: '/juntada/gasto-editar',
                          params: { id: id ?? '', expenseId: expense.id },
                        })
                      }
                      style={styles.iconButton}
                    >
                      <Ionicons color={colors.primary} name="pencil-outline" size={20} />
                    </Pressable>
                    <Pressable
                      hitSlop={8}
                      onPress={() => confirmDeleteExpense(expense)}
                      style={styles.iconButton}
                    >
                      <Ionicons color={colors.danger} name="trash-outline" size={20} />
                    </Pressable>
                  </View>
                </Card>
              ))
            )}

            {settlements.length > 0 ? (
              <>
                <SectionTitle style={styles.section} title="Pagos" />
                {settlements.map((settlement) => (
                  <Card key={settlement.id} style={styles.expenseCard}>
                    <View style={styles.expenseRow}>
                      <View style={styles.flex}>
                        <Text numberOfLines={1} style={styles.expenseDescription}>
                          {nameOf(settlement.fromId)} → {nameOf(settlement.toId)}
                        </Text>
                        <Text style={styles.expenseMeta}>Pago registrado</Text>
                      </View>
                      <Text style={[styles.expenseAmount, styles.settlementAmount]}>
                        {formatMoney(settlement.amountInt)}
                      </Text>
                      <Pressable
                        hitSlop={8}
                        onPress={() => confirmDeleteSettlement(settlement)}
                        style={styles.iconButton}
                      >
                        <Ionicons color={colors.danger} name="trash-outline" size={20} />
                      </Pressable>
                    </View>
                  </Card>
                ))}
              </>
            ) : null}

            <View style={[styles.sectionRow, styles.section]}>
              <SectionTitle style={styles.flex} title="Liquidación" />
              {expenses.length > 0 ? (
                <Button
                  onPress={shareSettlement}
                  style={styles.shareButton}
                  title="Compartir"
                  variant="secondary"
                />
              ) : null}
            </View>
            {expenses.length === 0 || !hasDebts ? (
              <EmptyState
                icon="checkmark-circle-outline"
                message={
                  expenses.length === 0
                    ? 'Cuando cargues gastos vas a ver quién le debe a quién.'
                    : 'Nadie le debe dinero a nadie.'
                }
                title={expenses.length === 0 ? 'Sin gastos todavía' : 'Todo saldado'}
              />
            ) : (
              <>
                <View style={styles.chipsRow}>
                  <Chip
                    label="Mínimo de transferencias"
                    onPress={() => setMode('min')}
                    selected={mode === 'min'}
                  />
                  <Chip label="Pago directo" onPress={() => setMode('direct')} selected={mode === 'direct'} />
                </View>
                <Card style={styles.settlementCard}>
                  <Text style={styles.settlementTitle}>Pagos necesarios</Text>
                  {transfers.map((transfer, index) => (
                    <View key={`${transfer.from}-${transfer.to}-${index}`} style={styles.transferRow}>
                      <Text style={[styles.transferNames, styles.flex]}>
                        {nameOf(transfer.from)} → {nameOf(transfer.to)}
                      </Text>
                      <Text style={styles.transferAmount}>{formatMoney(transfer.amount)}</Text>
                      <Pressable
                        hitSlop={8}
                        onPress={() => settleTransfer(transfer)}
                        style={styles.settleButton}
                      >
                        <Text style={styles.settleButtonText}>Saldar</Text>
                      </Pressable>
                    </View>
                  ))}
                  <Text style={styles.transferTotal}>
                    Total de transferencias: {transfers.length}
                  </Text>
                </Card>

                <Text style={styles.subTitle}>Balances</Text>
                {balances
                  .filter((balance) => balance.net !== 0)
                  .map((balance) => (
                    <View key={balance.personId} style={styles.balanceRow}>
                      <Text style={[styles.balanceName, styles.flex]}>{nameOf(balance.personId)}</Text>
                      <Text
                        style={[
                          styles.balanceAmount,
                          { color: balance.net > 0 ? colors.success : colors.danger },
                        ]}
                      >
                        {balance.net > 0 ? `+${formatMoney(balance.net)}` : formatMoney(balance.net)}
                      </Text>
                    </View>
                  ))}
              </>
            )}
          </>
        )}
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
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  title: {
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
    marginBottom: spacing.sm,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  segment: {
    backgroundColor: '#EEF0F4',
    borderRadius: radius.md,
    flexDirection: 'row',
    marginBottom: spacing.lg,
    marginTop: spacing.lg,
    padding: spacing.xs,
  },
  segmentItem: {
    alignItems: 'center',
    borderRadius: radius.sm,
    flex: 1,
    paddingVertical: spacing.md,
  },
  segmentItemActive: {
    backgroundColor: colors.card,
  },
  segmentLabel: {
    color: colors.textMuted,
    fontSize: fontSize.md,
    fontWeight: '600',
  },
  segmentLabelActive: {
    color: colors.text,
  },
  sectionRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  newExpenseButton: {
    marginBottom: spacing.md,
    minHeight: 44,
  },
  shareButton: {
    marginBottom: spacing.md,
    minHeight: 44,
  },
  total: {
    color: colors.text,
    fontSize: fontSize.md,
    fontWeight: '600',
    marginBottom: spacing.md,
  },
  expenseCard: {
    marginBottom: spacing.sm,
    padding: spacing.md,
  },
  expenseRow: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  expenseDescription: {
    color: colors.text,
    fontSize: fontSize.lg,
    fontWeight: '600',
  },
  expenseMeta: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    marginTop: 2,
  },
  expenseAmount: {
    color: colors.text,
    fontSize: fontSize.lg,
    fontWeight: '700',
    marginLeft: spacing.sm,
  },
  settlementAmount: {
    color: colors.success,
  },
  settleButton: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.pill,
    marginLeft: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  settleButtonText: {
    color: colors.primary,
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  iconButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    minWidth: 44,
  },
  section: {
    marginTop: spacing.xl,
  },
  settlementCard: {
    marginBottom: spacing.lg,
  },
  settlementTitle: {
    color: colors.text,
    fontSize: fontSize.lg,
    fontWeight: '700',
    marginBottom: spacing.md,
  },
  transferRow: {
    alignItems: 'center',
    flexDirection: 'row',
    paddingVertical: spacing.sm,
  },
  transferNames: {
    color: colors.text,
    fontSize: fontSize.md,
  },
  transferAmount: {
    color: colors.text,
    fontSize: fontSize.md,
    fontWeight: '700',
    marginLeft: spacing.sm,
  },
  transferTotal: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    fontWeight: '600',
    marginTop: spacing.sm,
  },
  subTitle: {
    color: colors.text,
    fontSize: fontSize.lg,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  balanceRow: {
    alignItems: 'center',
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    marginBottom: spacing.sm,
    minHeight: 48,
    paddingHorizontal: spacing.lg,
  },
  balanceName: {
    color: colors.text,
    fontSize: fontSize.md,
  },
  balanceAmount: {
    fontSize: fontSize.md,
    fontWeight: '700',
  },
  emptyButton: {
    marginTop: spacing.lg,
  },
  flex: {
    flex: 1,
  },
});

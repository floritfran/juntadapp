import { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import { getGetTogether } from '@/infrastructure/persistence/get-togethers-repository';
import { CASUAL_GET_TOGETHER_ID } from '@/infrastructure/persistence/migrations';
import { Screen } from '@/ui/components/Screen';
import { NewMatchForm } from '@/ui/games/NewMatchForm';
import { ClosedGetTogether } from '@/ui/get-togethers/ClosedGetTogether';
import { useColors } from '@/ui/theme';

export default function NuevaPartidaScreen() {
  const colors = useColors();
  const db = useSQLiteContext();
  const { id, game } = useLocalSearchParams<{ id?: string; game?: string }>();
  const [closed, setClosed] = useState(false);
  const [ready, setReady] = useState(false);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        if (!id || id === CASUAL_GET_TOGETHER_ID) {
          setClosed(false);
        } else {
          const getTogether = await getGetTogether(db, id);
          setClosed(getTogether?.status === 'closed');
        }
        setReady(true);
      })().catch(() => setReady(true));
    }, [db, id])
  );

  if (!ready) {
    return (
      <Screen>
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      </Screen>
    );
  }

  if (closed) return <ClosedGetTogether />;

  return (
    <NewMatchForm
      initialGame={game}
      prefillFromGetTogetherId={id}
      targetGetTogetherId={id ?? ''}
    />
  );
}

const styles = StyleSheet.create({
  loading: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
});

import { ScrollView, StyleSheet } from 'react-native';

import { CASUAL_GET_TOGETHER_ID } from '@/infrastructure/persistence/migrations';
import { Screen } from '@/ui/components/Screen';
import { GamesSection } from '@/ui/games/GamesSection';
import { spacing } from '@/ui/theme';

export default function JuegosScreen() {
  return (
    <Screen bottomInset={false}>
      <ScrollView contentContainerStyle={styles.content}>
        <GamesSection casual getTogetherId={CASUAL_GET_TOGETHER_ID} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.lg,
    paddingBottom: 48,
  },
});

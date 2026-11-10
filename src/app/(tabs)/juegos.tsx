import { StyleSheet } from 'react-native';

import { CASUAL_GET_TOGETHER_ID } from '@/infrastructure/persistence/migrations';
import { Screen } from '@/ui/components/Screen';
import { GamesSection } from '@/ui/games/GamesSection';
import { spacing } from '@/ui/theme';

export default function JuegosScreen() {
  return (
    <Screen bottomInset={false}>
      <GamesSection
        casual
        contentContainerStyle={styles.content}
        getTogetherId={CASUAL_GET_TOGETHER_ID}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.lg,
    paddingBottom: 48,
  },
});

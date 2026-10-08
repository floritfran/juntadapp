import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SQLiteProvider } from 'expo-sqlite';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { DATABASE_NAME, migrateDatabase } from '@/infrastructure/persistence/migrations';
import { colors } from '@/ui/theme';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <SQLiteProvider databaseName={DATABASE_NAME} onInit={migrateDatabase}>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: colors.bg },
            headerShadowVisible: false,
            headerTintColor: colors.text,
            headerTitleStyle: { fontWeight: '700' },
            contentStyle: { backgroundColor: colors.bg },
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="juntada/nueva" options={{ title: 'Nueva juntada', presentation: 'modal' }} />
          <Stack.Screen name="juntada/gasto-nuevo" options={{ title: 'Nuevo gasto', presentation: 'modal' }} />
          <Stack.Screen name="juntada/[id]" options={{ title: 'Juntada' }} />
        </Stack>
      </SQLiteProvider>
    </SafeAreaProvider>
  );
}

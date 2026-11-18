import { router } from 'expo-router';

import { Button } from '@/ui/components/Button';
import { EmptyState } from '@/ui/components/EmptyState';
import { Screen } from '@/ui/components/Screen';

export function ClosedGetTogether() {
  return (
    <Screen>
      <EmptyState
        icon="lock-closed-outline"
        message="Esta juntada está cerrada. Reabrila para cargar o editar gastos, pagos y partidas."
        title="Juntada cerrada"
      >
        <Button onPress={() => router.back()} title="Volver" variant="secondary" />
      </EmptyState>
    </Screen>
  );
}

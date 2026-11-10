import { useLocalSearchParams } from 'expo-router';

import { NewMatchForm } from '@/ui/games/NewMatchForm';

export default function NuevaPartidaScreen() {
  const { id, game } = useLocalSearchParams<{ id?: string; game?: string }>();

  return (
    <NewMatchForm
      initialGame={game}
      prefillFromGetTogetherId={id}
      targetGetTogetherId={id ?? ''}
    />
  );
}

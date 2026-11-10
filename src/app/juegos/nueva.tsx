import { CASUAL_GET_TOGETHER_ID } from '@/infrastructure/persistence/migrations';
import { NewMatchForm } from '@/ui/games/NewMatchForm';

export default function NuevaPartidaCasualScreen() {
  return <NewMatchForm targetGetTogetherId={CASUAL_GET_TOGETHER_ID} />;
}

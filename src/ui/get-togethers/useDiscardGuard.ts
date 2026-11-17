import { usePreventRemove } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';
import { Alert } from 'react-native';

export function useDiscardGuard(shouldWarn: boolean) {
  const disableRef = useRef<(() => void) | null>(null);

  const disable = usePreventRemove(shouldWarn, ({ repeat }) => {
    Alert.alert('Descartar cambios', 'Tenés cambios sin guardar. ¿Querés descartarlos?', [
      { text: 'Seguir editando', style: 'cancel' },
      { text: 'Descartar', style: 'destructive', onPress: repeat },
    ]);
  });

  useEffect(() => {
    disableRef.current = disable;
  }, [disable]);

  return useCallback(() => disableRef.current?.(), []);
}

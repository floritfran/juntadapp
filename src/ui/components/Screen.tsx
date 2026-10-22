import { ReactNode, useMemo } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useColors, type Colors } from '../theme';

interface Props {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  bottomInset?: boolean;
}

export function Screen({ children, style, bottomInset = true }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={[styles.screen, bottomInset && { paddingBottom: insets.bottom }, style]}>
      {children}
    </View>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
});

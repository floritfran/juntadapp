import { ReactNode, useMemo } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import { useColors, type Colors } from '../theme';

interface Props {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function Screen({ children, style }: Props) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return <View style={[styles.screen, style]}>{children}</View>;
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
});

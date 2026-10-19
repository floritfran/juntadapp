import { useMemo } from 'react';
import { StyleProp, StyleSheet, Text, TextStyle } from 'react-native';

import { fontSize, spacing, useColors, type Colors } from '../theme';

interface Props {
  title: string;
  style?: StyleProp<TextStyle>;
}

export function SectionTitle({ title, style }: Props) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return <Text style={[styles.title, style]}>{title}</Text>;
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  title: {
    color: colors.text,
    fontSize: fontSize.xl,
    fontWeight: '700',
    marginBottom: spacing.md,
  },
});

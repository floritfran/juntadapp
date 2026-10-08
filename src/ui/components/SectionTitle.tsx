import { StyleProp, StyleSheet, Text, TextStyle } from 'react-native';

import { colors, fontSize, spacing } from '../theme';

interface Props {
  title: string;
  style?: StyleProp<TextStyle>;
}

export function SectionTitle({ title, style }: Props) {
  return <Text style={[styles.title, style]}>{title}</Text>;
}

const styles = StyleSheet.create({
  title: {
    color: colors.text,
    fontSize: fontSize.xl,
    fontWeight: '700',
    marginBottom: spacing.md,
  },
});

import { Ionicons } from '@expo/vector-icons';
import { ComponentProps, ReactNode, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { fontSize, spacing, useColors, type Colors } from '../theme';

interface Props {
  icon: ComponentProps<typeof Ionicons>['name'];
  title: string;
  message?: string;
  children?: ReactNode;
}

export function EmptyState({ icon, title, message, children }: Props) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.container}>
      <Ionicons color={colors.textMuted} name={icon} size={48} />
      <Text style={styles.title}>{title}</Text>
      {message ? <Text style={styles.message}>{message}</Text> : null}
      {children}
    </View>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.xl,
  },
  title: {
    color: colors.text,
    fontSize: fontSize.xl,
    fontWeight: '700',
    marginTop: spacing.md,
    textAlign: 'center',
  },
  message: {
    color: colors.textMuted,
    fontSize: fontSize.md,
    marginTop: spacing.sm,
    textAlign: 'center',
    lineHeight: 21,
  },
});

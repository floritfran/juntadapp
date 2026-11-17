import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { fontSize, spacing, useColors, type Colors } from '../theme';

interface Props {
  label: string;
  checked: boolean;
  onToggle: () => void;
  disabled?: boolean;
}

export function CheckRow({ label, checked, onToggle, disabled = false }: Props) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled }}
      disabled={disabled}
      onPress={onToggle}
      style={({ pressed }) => [styles.row, pressed && !disabled && styles.pressed]}
    >
      <View style={styles.labelRow}>
        {disabled ? <Ionicons color={colors.textMuted} name="lock-closed" size={14} style={styles.lock} /> : null}
        <Text style={[styles.label, checked && styles.labelChecked]} numberOfLines={1}>
          {label}
        </Text>
      </View>
      <Ionicons
        color={checked ? colors.primary : colors.iconMuted}
        name={checked ? 'checkmark-circle' : 'ellipse-outline'}
        size={26}
      />
    </Pressable>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 52,
    paddingVertical: spacing.sm,
  },
  pressed: {
    opacity: 0.7,
  },
  labelRow: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    marginRight: spacing.md,
  },
  lock: {
    marginRight: spacing.xs,
  },
  label: {
    color: colors.text,
    flex: 1,
    fontSize: fontSize.lg,
  },
  labelChecked: {
    fontWeight: '600',
  },
});

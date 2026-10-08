import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text } from 'react-native';

import { colors, fontSize, spacing } from '../theme';

interface Props {
  label: string;
  checked: boolean;
  onToggle: () => void;
}

export function CheckRow({ label, checked, onToggle }: Props) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      onPress={onToggle}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <Text style={[styles.label, checked && styles.labelChecked]} numberOfLines={1}>
        {label}
      </Text>
      <Ionicons
        color={checked ? colors.primary : '#9CA3AF'}
        name={checked ? 'checkmark-circle' : 'ellipse-outline'}
        size={26}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
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
  label: {
    color: colors.text,
    flex: 1,
    fontSize: fontSize.lg,
    marginRight: spacing.md,
  },
  labelChecked: {
    fontWeight: '600',
  },
});

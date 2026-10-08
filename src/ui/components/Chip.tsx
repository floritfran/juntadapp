import { Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';

import { colors, fontSize, radius, spacing } from '../theme';

interface Props {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

export function Chip({ label, selected = false, onPress, style }: Props) {
  const content = (
    <Text style={[styles.label, selected && styles.labelSelected]} numberOfLines={1}>
      {label}
    </Text>
  );
  if (!onPress) {
    return <View style={[styles.chip, selected && styles.chipSelected, style]}>{content}</View>;
  }
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        selected && styles.chipSelected,
        pressed && styles.pressed,
        style,
      ]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    backgroundColor: '#EEF0F4',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    marginRight: spacing.sm,
    marginBottom: spacing.sm,
  },
  chipSelected: {
    backgroundColor: colors.primary,
  },
  pressed: {
    opacity: 0.75,
  },
  label: {
    color: colors.text,
    fontSize: fontSize.md,
    fontWeight: '500',
  },
  labelSelected: {
    color: colors.onPrimary,
    fontWeight: '600',
  },
});

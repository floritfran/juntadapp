import { Ionicons } from '@expo/vector-icons';
import { ComponentProps, useMemo } from 'react';
import { StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';

import { fontSize, radius, spacing, useColors, type Colors } from '../theme';

interface Props extends Pick<TextInputProps, 'keyboardType' | 'autoCapitalize' | 'returnKeyType' | 'onSubmitEditing'> {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  error?: string | null;
  icon?: ComponentProps<typeof Ionicons>['name'];
}

export function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  keyboardType,
  autoCapitalize,
  returnKeyType,
  onSubmitEditing,
  icon,
}: Props) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const hasError = error != null && error !== '';
  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      {icon ? (
        <View style={[styles.input, hasError && styles.inputError, styles.inputRow]}>
          <Ionicons color={colors.iconMuted} name={icon} size={20} />
          <TextInput
            autoCapitalize={autoCapitalize}
            keyboardType={keyboardType}
            onChangeText={onChangeText}
            onSubmitEditing={onSubmitEditing}
            placeholder={placeholder}
            placeholderTextColor={colors.textMuted}
            returnKeyType={returnKeyType}
            style={styles.inputField}
            value={value}
          />
        </View>
      ) : (
        <TextInput
          autoCapitalize={autoCapitalize}
          keyboardType={keyboardType}
          onChangeText={onChangeText}
          onSubmitEditing={onSubmitEditing}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          returnKeyType={returnKeyType}
          style={[styles.input, hasError && styles.inputError]}
          value={value}
        />
      )}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  wrapper: {
    marginBottom: spacing.lg,
  },
  label: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    fontWeight: '600',
    marginBottom: spacing.xs + 2,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    color: colors.text,
    fontSize: fontSize.lg,
    minHeight: 52,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  inputRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  inputField: {
    color: colors.text,
    flex: 1,
    fontSize: fontSize.lg,
    paddingVertical: 0,
  },
  inputError: {
    borderColor: colors.danger,
  },
  error: {
    color: colors.danger,
    fontSize: fontSize.sm,
    marginTop: spacing.xs,
  },
});

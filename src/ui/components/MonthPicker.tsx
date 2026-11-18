import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { monthKeyFrom, parseMonthKey } from '@/domain/get-togethers/get-together-filters';
import { Chip } from './Chip';
import { fontSize, radius, spacing, useColors, type Colors } from '../theme';

const MONTH_LABELS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const MONTH_FULL_LABELS = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];
const MIN_YEAR = 1900;
const MAX_YEAR = 2100;

interface Props {
  value: string | null;
  onChange: (monthKey: string | null) => void;
}

export function MonthPicker({ value, onChange }: Props) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const selected = value === null ? null : parseMonthKey(value);
  const [yearText, setYearText] = useState(() => String(selected?.year ?? new Date().getFullYear()));

  const parsedYear = /^\d{4}$/.test(yearText) ? Number(yearText) : null;
  const yearIsValid = parsedYear !== null && parsedYear >= MIN_YEAR && parsedYear <= MAX_YEAR;

  const selectMonth = (month: number) => {
    if (parsedYear === null || !yearIsValid) return;
    onChange(monthKeyFrom(parsedYear, month));
  };

  const changeYear = (delta: number) => {
    const base = selected?.year ?? parsedYear ?? new Date().getFullYear();
    const nextYear = Math.min(MAX_YEAR, Math.max(MIN_YEAR, base + delta));
    setYearText(String(nextYear));
    if (selected !== null) onChange(monthKeyFrom(nextYear, selected.month));
  };

  const handleYearText = (text: string) => {
    const digits = text.replace(/\D/g, '').slice(0, 4);
    setYearText(digits);
    const nextYear = /^\d{4}$/.test(digits) ? Number(digits) : null;
    if (selected !== null && nextYear !== null && nextYear >= MIN_YEAR && nextYear <= MAX_YEAR) {
      onChange(monthKeyFrom(nextYear, selected.month));
    }
  };

  const handleYearBlur = () => {
    if (yearIsValid) return;
    setYearText(String(selected?.year ?? new Date().getFullYear()));
  };

  return (
    <View style={styles.wrapper}>
      <Chip label="Todas las fechas" onPress={() => onChange(null)} selected={value === null} />
      <Text style={styles.label}>Año</Text>
      <View style={styles.yearRow}>
        <Pressable
          accessibilityLabel="Año anterior"
          onPress={() => changeYear(-1)}
          style={({ pressed }) => [styles.yearButton, pressed && styles.pressed]}
        >
          <Ionicons color={colors.text} name="chevron-back" size={20} />
        </Pressable>
        <TextInput
          accessibilityLabel="Año del filtro"
          keyboardType="number-pad"
          maxLength={4}
          onBlur={handleYearBlur}
          onChangeText={handleYearText}
          returnKeyType="done"
          style={styles.yearInput}
          textAlign="center"
          underlineColorAndroid="transparent"
          value={yearText}
        />
        <Pressable
          accessibilityLabel="Año siguiente"
          onPress={() => changeYear(1)}
          style={({ pressed }) => [styles.yearButton, pressed && styles.pressed]}
        >
          <Ionicons color={colors.text} name="chevron-forward" size={20} />
        </Pressable>
      </View>
      <View style={styles.monthGrid}>
        {[0, 6].map((start) => (
          <View key={start} style={styles.monthRow}>
            {MONTH_LABELS.slice(start, start + 6).map((label, index) => {
              const monthNumber = start + index + 1;
              const isSelected = selected?.month === monthNumber;
              return (
                <Pressable
                  accessibilityLabel={`${MONTH_FULL_LABELS[monthNumber - 1]} ${yearText}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  disabled={!yearIsValid}
                  key={label}
                  onPress={() => selectMonth(monthNumber)}
                  style={({ pressed }) => [
                    styles.monthChip,
                    isSelected && styles.monthChipSelected,
                    pressed && styles.pressed,
                    !yearIsValid && styles.disabled,
                  ]}
                >
                  <Text style={[styles.monthLabel, isSelected && styles.monthLabelSelected]}>{label}</Text>
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
      <Text style={styles.hint}>Elegí un mes para filtrar por fecha.</Text>
    </View>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  wrapper: {
    marginBottom: spacing.sm,
  },
  label: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    fontWeight: '600',
    marginBottom: spacing.xs + 2,
    marginTop: spacing.sm,
    textTransform: 'uppercase',
  },
  yearRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  yearButton: {
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    height: 52,
    justifyContent: 'center',
    width: 52,
  },
  yearInput: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    color: colors.text,
    flex: 1,
    fontSize: fontSize.lg,
    fontWeight: '700',
    height: 52,
    includeFontPadding: false,
    lineHeight: 24,
    marginHorizontal: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 0,
    textAlignVertical: 'center',
  },
  monthGrid: {
    gap: spacing.sm,
  },
  monthRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  monthChip: {
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.pill,
    flex: 1,
    justifyContent: 'center',
    minWidth: 0,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.sm,
  },
  monthChipSelected: {
    backgroundColor: colors.primary,
  },
  monthLabel: {
    color: colors.text,
    fontSize: fontSize.sm,
    fontWeight: '600',
    textAlign: 'center',
  },
  monthLabelSelected: {
    color: colors.onPrimary,
  },
  hint: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    lineHeight: 18,
  },
  pressed: {
    opacity: 0.75,
  },
  disabled: {
    opacity: 0.45,
  },
});

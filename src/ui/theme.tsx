import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

export type Colors = {
  bg: string;
  card: string;
  text: string;
  textMuted: string;
  border: string;
  primary: string;
  primarySoft: string;
  onPrimary: string;
  danger: string;
  dangerSoft: string;
  success: string;
  successSoft: string;
  warning: string;
  surfaceAlt: string;
  iconMuted: string;
};

export const lightColors: Colors = {
  bg: '#F4F5F7',
  card: '#FFFFFF',
  text: '#111827',
  textMuted: '#6B7280',
  border: '#E5E7EB',
  primary: '#4F46E5',
  primarySoft: '#EEF2FF',
  onPrimary: '#FFFFFF',
  danger: '#DC2626',
  dangerSoft: '#FEE2E2',
  success: '#16A34A',
  successSoft: '#ECFDF5',
  warning: '#D97706',
  surfaceAlt: '#EEF0F4',
  iconMuted: '#9CA3AF',
};

export const darkColors: Colors = {
  bg: '#0F172A',
  card: '#1E293B',
  text: '#F8FAFC',
  textMuted: '#94A3B8',
  border: '#334155',
  primary: '#818CF8',
  primarySoft: 'rgba(129, 140, 248, 0.16)',
  onPrimary: '#0F172A',
  danger: '#F87171',
  dangerSoft: 'rgba(248, 113, 113, 0.16)',
  success: '#4ADE80',
  successSoft: 'rgba(74, 222, 128, 0.16)',
  warning: '#FBBF24',
  surfaceAlt: '#2B3444',
  iconMuted: '#9CA3AF',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
} as const;

export const fontSize = {
  sm: 13,
  md: 15,
  lg: 17,
  xl: 22,
  xxl: 28,
} as const;

export type ColorScheme = 'light' | 'dark';

type ThemeValue = {
  colors: Colors;
  scheme: ColorScheme;
};

const ThemeContext = createContext<ThemeValue>({
  colors: lightColors,
  scheme: 'light',
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const scheme: ColorScheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const value = useMemo<ThemeValue>(
    () => ({ colors: scheme === 'dark' ? darkColors : lightColors, scheme }),
    [scheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  return useContext(ThemeContext);
}

export function useColors(): Colors {
  return useContext(ThemeContext).colors;
}

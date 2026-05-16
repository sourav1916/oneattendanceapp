import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useColorScheme } from 'react-native';

import { getThemePreference, setThemePreference, type ThemePreference } from '@src/storage/themeStorage';
import { darkTheme, lightTheme, type AppThemeColors } from '@src/theme/palettes';

type ThemeContextValue = {
  colors: AppThemeColors;
  preference: ThemePreference;
  resolvedScheme: 'light' | 'dark';
  hydrated: boolean;
  setPreference: (next: ThemePreference) => Promise<void>;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>('system');
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let alive = true;
    void getThemePreference().then(stored => {
      if (!alive) {
        return;
      }
      if (stored) {
        setPreferenceState(stored);
      }
      setHydrated(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  const resolvedScheme: 'light' | 'dark' =
    preference === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : preference;

  const colors = resolvedScheme === 'dark' ? darkTheme : lightTheme;

  const setPreference = useCallback(async (next: ThemePreference) => {
    setPreferenceState(next);
    await setThemePreference(next);
  }, []);

  const value = useMemo(
    (): ThemeContextValue => ({
      colors,
      preference,
      resolvedScheme,
      hydrated,
      setPreference,
    }),
    [colors, preference, resolvedScheme, hydrated, setPreference],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useAppTheme must be used within ThemeProvider');
  }
  return ctx;
}

export function useThemeColors(): AppThemeColors {
  return useAppTheme().colors;
}

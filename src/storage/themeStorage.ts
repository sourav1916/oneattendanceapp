import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemePreference = 'light' | 'dark' | 'system';

const KEY = '@oneattendance/theme_preference';

function isThemePreference(v: string | null): v is ThemePreference {
  return v === 'light' || v === 'dark' || v === 'system';
}

export async function getThemePreference(): Promise<ThemePreference | null> {
  const raw = await AsyncStorage.getItem(KEY);
  return isThemePreference(raw) ? raw : null;
}

export async function setThemePreference(value: ThemePreference): Promise<void> {
  await AsyncStorage.setItem(KEY, value);
}

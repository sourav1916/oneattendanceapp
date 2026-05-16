import AsyncStorage from '@react-native-async-storage/async-storage';

import { isAppLanguage } from '@src/i18n/languages';
import type { AppLanguage } from '@src/i18n/types';

const KEY = '@oneattendance/language_override';

export async function getLanguageOverride(): Promise<AppLanguage | null> {
  const raw = await AsyncStorage.getItem(KEY);
  return isAppLanguage(raw) ? raw : null;
}

export async function setLanguageOverride(lang: AppLanguage): Promise<void> {
  await AsyncStorage.setItem(KEY, lang);
}

export async function clearLanguageOverride(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}

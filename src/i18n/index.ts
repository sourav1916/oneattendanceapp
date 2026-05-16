import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import { bn } from '@src/locales/bn';
import { en } from '@src/locales/en';
import { gu } from '@src/locales/gu';
import { hi } from '@src/locales/hi';
import { kn } from '@src/locales/kn';
import { ml } from '@src/locales/ml';
import { mr } from '@src/locales/mr';
import { pa } from '@src/locales/pa';
import { ta } from '@src/locales/ta';
import { te } from '@src/locales/te';
import {
  getLanguageOverride,
  setLanguageOverride,
} from '@src/storage/languageStorage';

import type { AppLanguage } from './languages';

export type { AppLanguage } from './languages';
export {
  SUPPORTED_LANGUAGES,
  isAppLanguage,
  localeTagForFormatting,
} from './languages';
void i18n.use(initReactI18next).init({
  compatibilityJSON: 'v4',
  resources: {
    en: { translation: en },
    hi: { translation: hi },
    bn: { translation: bn },
    ta: { translation: ta },
    te: { translation: te },
    mr: { translation: mr },
    kn: { translation: kn },
    ml: { translation: ml },
    gu: { translation: gu },
    pa: { translation: pa },
  },
  lng: 'en',
  fallbackLng: 'en',
  supportedLngs: ['en', 'hi', 'bn', 'ta', 'te', 'mr', 'kn', 'ml', 'gu', 'pa'],
  interpolation: {
    escapeValue: false,
  },
});

/** Apply a saved language override on cold start (after sync init from device). */
export async function hydrateLanguageFromPreference(): Promise<void> {
  const override = await getLanguageOverride();
  await i18n.changeLanguage(override ?? 'en');
}

export async function setAppLanguage(lang: AppLanguage): Promise<void> {
  await setLanguageOverride(lang);
  await i18n.changeLanguage(lang);
}

export default i18n;

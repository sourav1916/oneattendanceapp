/** Priority order: 1 English … 10 Punjabi (ISO 639-1 codes). */
export const SUPPORTED_LANGUAGES = [
  { id: 'en', english: 'English', native: 'English' },
  { id: 'hi', english: 'Hindi', native: 'हिन्दी' },
  { id: 'bn', english: 'Bengali', native: 'বাংলা' },
  { id: 'ta', english: 'Tamil', native: 'தமிழ்' },
  { id: 'te', english: 'Telugu', native: 'తెలుగు' },
  { id: 'mr', english: 'Marathi', native: 'मराठी' },
  { id: 'kn', english: 'Kannada', native: 'ಕನ್ನಡ' },
  { id: 'ml', english: 'Malayalam', native: 'മലയാളം' },
  { id: 'gu', english: 'Gujarati', native: 'ગુજરાતી' },
  { id: 'pa', english: 'Punjabi', native: 'ਪੰਜਾਬੀ' },
] as const;

export type AppLanguage = (typeof SUPPORTED_LANGUAGES)[number]['id'];

const LANGUAGE_IDS = new Set<string>(SUPPORTED_LANGUAGES.map(l => l.id));

export function isAppLanguage(value: string | null | undefined): value is AppLanguage {
  return value != null && LANGUAGE_IDS.has(value);
}

/** BCP 47 tags for time formatting (India region where applicable). */
export function localeTagForFormatting(lang: string): string {
  const map: Record<AppLanguage, string> = {
    en: 'en-IN',
    hi: 'hi-IN',
    bn: 'bn-IN',
    ta: 'ta-IN',
    te: 'te-IN',
    mr: 'mr-IN',
    kn: 'kn-IN',
    ml: 'ml-IN',
    gu: 'gu-IN',
    pa: 'pa-IN',
  };
  return isAppLanguage(lang) ? map[lang] : 'en-IN';
}

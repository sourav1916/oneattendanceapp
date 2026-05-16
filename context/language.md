# One Attendance — Language & i18n (`context/language.md`)

Attach this file when working on **translations**, **language picker**, or **locale-specific formatting**.

---

## Stack

- **`i18next`** + **`react-i18next`**
- Init: **`src/i18n/index.ts`** (imported at top of `App.tsx` as `import '@src/i18n'`)

---

## Resource files

- Each language is a **TypeScript module** exporting a nested object, e.g. **`src/locales/en.ts`**, **`src/locales/hi.ts`**, plus `bn`, `ta`, `te`, `mr`, `kn`, `ml`, `gu`, `pa`.
- Keys are nested (`settings.sessions.title`, `home.menu.attendance`, …).
- **`i18n.init`** registers all in `resources`; `fallbackLng: 'en'`, `supportedLngs` lists every code.

---

## Changing language at runtime

- **`setAppLanguage(lang)`** in `src/i18n/index.ts`: persists via **`src/storage/languageStorage.ts`** and calls **`i18n.changeLanguage(lang)`**.
- **`hydrateLanguageFromPreference()`**: read storage on cold start; called from **`App.tsx`** inside `AppBody` `useEffect`.

---

## Supported languages metadata

- **`src/i18n/languages.ts`**: `SUPPORTED_LANGUAGES` (id, english label, native label), type **`AppLanguage`**, **`isAppLanguage()`**, **`localeTagForFormatting()`** (BCP 47 for `Intl` / date formatting, mostly `*-IN`).

---

## UI: Language picker modal

- **`src/components/modals/LanguagePicker.tsx`**
- Opened from **Settings**; uses `SUPPORTED_LANGUAGES`, calls `setAppLanguage` on select.
- **Layout reference**: centered sheet, `maxWidth: 400`, max height ~78% screen — other modals (e.g. `ThemePicker`) follow similar patterns.

---

## Conventions for new strings

1. Add key to **`en.ts`** first (source of truth for structure).
2. Mirror in **`hi.ts`** (and other locale files if you need them translated).
3. Use **`useTranslation()`** → `t('group.key')` or `t('group.key', { var })`.
4. For dates/times tied to user language, use **`localeTagForFormatting(i18n.language)`** (see `SessionScreen`, `sessionDateFormat.ts`).

---

## Pitfalls

- Do not break **`supportedLngs`** — unknown codes fall back oddly.
- **Interpolation**: `escapeValue: false` in i18n config; still avoid user HTML in strings.

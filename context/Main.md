# One Attendance — Project context (main)

This folder (`context/`) holds **documentation for AI and humans**, not runtime code. App source lives under `src/`. React app contexts live under `src/context/` (different path).

---

## 1. What this project is

**One Attendance** is a **React Native 0.85** mobile app (Android / iOS) for attendance and related HR-style workflows. Product site: `https://attendance.onesaas.in` (`APP_PORTAL_URL` in `src/utils/config.ts`). REST API: `https://api-attendance.onesaas.in` (`API_ENDPOINT`).

- **Auth**: Email/password + OTP verification; session stored locally.
- **Shell after login**: Bottom tabs (**Home**, **Attendance**, **Settings**) + a **custom top bar** (company + profile entry).
- **Company**: Users with multiple companies from `/users/profile-role` must pick one (`CompanySelectionGate` + pickers).
- **i18n**: Many Indian languages + English (`src/i18n`, `src/locales/*`).
- **Theming**: Light / dark / system, persisted (`ThemeContext`, `src/theme/palettes.ts`).

---

## 2. Tech stack (high level)

| Area | Choice |
|------|--------|
| UI | React Native 0.85, React 19 |
| Navigation | `@react-navigation/native` v7, **bottom tabs** + **native stack** |
| HTTP | `axios` via `src/api/authHttpClient.ts` (Bearer + 401 → sign out) |
| Storage | `@react-native-async-storage/async-storage` |
| i18n | `i18next` + `react-i18next` |
| Icons | `react-native-vector-icons` → **MaterialCommunityIcons** (tab bar + home grid); fonts wired in Android `fonts.gradle` + iOS `Info.plist` |
| Paths | Babel alias **`@src`** → `./src` (`babel.config.js`) |

---

## 3. Repo layout (what lives where)

```
App/
├── App.tsx                 # Root: SafeAreaProvider → ThemeProvider → Auth → NavigationContainer
├── index.js
├── babel.config.js         # module-resolver: @src → ./src
├── context/                # THIS DOCS FOLDER (not src/context)
├── src/
│   ├── api/                # HTTP clients & endpoints (axios)
│   ├── components/         # Reusable UI (MainTopBar, modals, gates, icons)
│   ├── context/            # AuthContext, ThemeContext (runtime)
│   ├── i18n/               # i18n init, languages list
│   ├── locales/            # Per-language translation objects (en, hi, …)
│   ├── navigation/         # AuthNavigator, MainNavigator, SettingsNavigator, types
│   ├── screens/            # auth/, home/, attendance/, settings/
│   ├── storage/            # AsyncStorage helpers (auth, company, language, theme)
│   ├── theme/              # lightTheme / darkTheme palettes
│   ├── types/              # Shared TS types for API responses
│   └── utils/              # config, readApiError, sessionDateFormat, companiesFromProfileRole, …
├── android/
└── ios/
```

**Note**: `HomeScreen` is **`HomeScreen.js`** (JS); most other screens are **`.tsx`**.

---

## 4. How the app boots (`App.tsx`)

1. **`@src/i18n`** is imported first so `t()` is ready.
2. **`SafeAreaProvider`** wraps everything.
3. **`ThemeProvider`** loads saved theme preference, exposes `colors`, `resolvedScheme`, `setPreference`.
4. **`AuthProvider`** loads token + user + company from storage, configures `authHttpClient`, may fetch `profileRole`.
5. **`NavigationContainer`** uses a theme derived from app colors.
6. **`RootNavigation`**:
   - Until **`hydrated`**: full-screen spinner.
   - If **`token`**: **`MainNavigator`** (logged-in shell).
   - Else: **`AuthNavigator`** (login stack).

7. On mount, **`hydrateLanguageFromPreference()`** applies saved language.

---

## 5. Authentication flow

- **`src/context/AuthContext.tsx`**: Single source of truth for `token`, `email`, `name`, `selectedCompany`, `profileRole`, `hydrated`, `signIn`, `signOut`, `refreshProfileRole`, `selectCompany`.
- **`src/storage/authStorage.ts`**: Persist session fields after login.
- **`configureAuthHttpClient`**: Injects Bearer token; on **401** runs **`signOut`** (clears storage + state).
- **Public auth requests** (OTP, etc.) must **not** use `authHttpClient` if a 401 should not wipe the session — see comments in `authHttpClient.ts`.

**Auth screens** (`src/screens/auth/`): Login, Register, ForgotPassword, VerifyEmailOtp — all in **`AuthNavigator`** with `headerShown: false`.

---

## 6. Logged-in shell (`MainNavigator.tsx`)

- **Bottom tabs**: `Home` | `Attendance` | `Settings`.
- **Header**: Custom **`MainTopBar`** for every tab (company name/logo, company switcher if allowed, avatar → navigates to **Settings** tab).
- **Tab icons**: `MaterialCommunityIcons` (outline when inactive, solid when focused) + animated vertical lift.
- **`Settings` tab** is not a single screen: it is **`SettingsNavigator`** (native stack: `SettingsHome` → `Sessions`, etc.).

**`CompanySelectionGate`** wraps the tab navigator: if the user has eligible companies but none selected, shows **`CompanyPicker`** until they choose.

---

## 7. Main feature areas (screens)

| Area | Path | Notes |
|------|------|--------|
| Home | `src/screens/home/HomeScreen.js` | Welcome card + 3-column action grid; Attendance tab jump; other tiles → coming soon |
| Attendance | `src/screens/attendance/AttendanceScreen.tsx` | Punch / methods UI |
| Settings | `src/screens/settings/SettingsScreen.tsx` | Menu sections → profile, sessions, language, theme, sign out |
| Sessions | `src/screens/settings/SessionScreen.tsx` | Custom compact header (no native stack header gap); active sessions, Nominatim geocode, logout one / logout others |

---

## 8. API layer (`src/api/`)

- **`authHttpClient.ts`**: Axios instance with `baseURL: API_ENDPOINT`, Bearer from `AuthContext` ref, 401 handler.
- Examples: `requestLoginOtp`, `verifyLoginOtp`, `fetchProfileRole`, `fetchActiveSessions`, `logoutSession`, `logoutAllOtherSessions`, `nominatimReverseGeocode` (external OSM; User-Agent + rate limit).

Types for responses live in **`src/types/`**.

---

## 9. Cross-cutting patterns

- **Strings**: Prefer **`useTranslation()`** + keys under `src/locales/en.ts` (and mirror in `hi.ts` etc.).
- **Colors**: **`useThemeColors()`** or **`useAppTheme()`** when you need `resolvedScheme` (e.g. subtle surfaces).
- **Errors from axios**: **`readApiError`** (`src/utils/readApiError.ts`).
- **Confirm / alert UI**: **`useConfirmAlert` + `<ConfirmAlert {...props} />`** — see `context/alerts.md` and `context/modals.md`.

---

## 10. Native / build notes

- **Android**: `react-native-vector-icons` — `fonts.gradle` + `iconFontNames: ['MaterialCommunityIcons.ttf']` in `android/app/build.gradle`.
- **iOS**: `UIAppFonts` includes `MaterialCommunityIcons.ttf` in `Info.plist`; run **`pod install`** after dependency changes.

---

## 11. Companion context files (attach in chats)

| File | Use when |
|------|----------|
| `context/language.md` | i18n, locales, language picker |
| `context/theme-api.md` | Theme, palettes, API client rules |
| `context/navigation.md` | Navigators, types, tab vs stack |
| `context/modals.md` | Modal components, layout conventions |
| `context/alerts.md` | ConfirmAlert / `useConfirmAlert` API |

---

## 12. Commands

- `npm start` — Metro  
- `npm run android` / `npm run ios` — run app  
- `npx tsc --noEmit` — Typecheck (JS files like `HomeScreen.js` are looser)  
- `npm run lint` — ESLint  

---

*Last aligned with codebase structure: monorepo-style single app under `APP/`, React Native 0.85.*

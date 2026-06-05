# One Attendance — Project context (main)

This folder (`context/`) holds **documentation for AI and humans**, not runtime code. App source lives under `src/`. React app contexts live under `src/context/` (different path).

**Prompt usage:** Attach **`context/Main.md`** first for the project overview, then attach any linked topic files below for deeper detail.

### Context index (all docs in this folder)

| Doc | Use when |
|------|----------|
| [**Main.md**](./Main.md) | Overview, boot flow, repo layout, API patterns, commands (this file) |
| [**SHA.md**](./SHA.md) | Android signing, SHA-1/SHA-256 fingerprints, Firebase / Google APIs |
| [**truecaller.md**](./truecaller.md) | Truecaller OAuth on login, client ID, Android manifest |
| [**google-signin.md**](./google-signin.md) | Google Sign-In, DEVELOPER_ERROR, SHA-1 / OAuth setup |
| [**language.md**](./language.md) | i18n, locales, language picker, `t()` keys |
| [**theme-api.md**](./theme-api.md) | Light/dark theme, palettes, `authHttpClient`, API rules |
| [**navigation.md**](./navigation.md) | Navigators, route types, tabs vs stacks, headers |
| [**my-calendar.md**](./my-calendar.md) | Employee attendance calendar, `/shifts/my-calendar`, `Calendar.tsx` |
| [**modals.md**](./modals.md) | Modal layout, language/theme/company pickers, sheet patterns |
| [**company.md**](./company.md) | Company list, create company modal, employee screens, `/company/*` APIs |
| [**face-enroll.md**](./face-enroll.md) | Face enroll list/capture, image upload, `/employees/face-enroll/*`, Vision Camera |
| [**alerts.md**](./alerts.md) | `ConfirmAlert`, `StatusAlert`, confirms and success/error popups |
| [**profile.md**](./profile.md) | Profile / EditProfile, avatar upload, update-profile, profile-role cache |
| [**home.md**](./home.md) | HomeScreen, MainTopBar, company switcher arrow, pull-to-refresh |
| [**leave-management.md**](./leave-management.md) | Manager leave hub, requests, balances, leave types (config), employee `LeaveRequest` |

---

## 1. What this project is

**One Attendance** is a **React Native 0.85** mobile app (Android / iOS) for attendance and related HR-style workflows. Product site: `https://attendance.onesaas.in` (`APP_PORTAL_URL` in `src/utils/config.ts`). REST API: `https://api-attendance.onesaas.in` (`API_ENDPOINT`).

- **Auth**: Email/password + OTP verification; session stored locally.
- **Shell after login**: Bottom tabs (**Home**, **Attendance** or **Attendance Management** for owners, optional **Face Attendance**, **Settings**) + a **custom top bar** (company + profile entry).
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
│   ├── screens/            # auth/, home/, attendance/, settings/, report/, company/, profile/
│   ├── storage/            # AsyncStorage helpers (auth, company, language, theme)
│   ├── constants/          # tabScreenLayout (safe area + scroll padding for tab screens)
│   ├── theme/              # lightTheme / darkTheme palettes
│   ├── types/              # Shared TS types for API responses
│   └── utils/              # config, readApiError, FileUpload, parseFaceEnrollCheckResult, …
├── android/
└── ios/
```

**Note**: Most screens are **`.tsx`** under `src/screens/`.

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

- **`src/context/AuthContext.tsx`**: Single source of truth for `token`, `email`, `name`, `selectedCompany`, `profileRole`, `cachedUserProfile`, `profileRoleUser`, `hydrated`, `signIn`, `signOut`, `refreshProfileRole`, `applySessionFromProfileUpdate`, `selectCompany`.
- **`src/storage/authStorage.ts`**: Persist session fields after login.
- **`configureAuthHttpClient`**: Injects Bearer token; on **401** runs **`signOut`** (clears storage + state).
- **Public auth requests** (OTP, etc.) must **not** use `authHttpClient` if a 401 should not wipe the session — see comments in `authHttpClient.ts`.

**Auth screens** (`src/screens/auth/`): Login, Register, ForgotPassword, VerifyEmailOtp — all in **`AuthNavigator`** with `headerShown: false`.

---

## 6. Logged-in shell (`MainNavigator.tsx`)

- **Bottom tabs**: `Home` | `Attendance` | `Settings`.
- **Header**: Custom **`MainTopBar`** for every tab — company name (or “One Attendance”), ▼ opens **`CompanySwitcher`** (including when user has **no** companies yet), profile photo from cache — see [**home.md**](./home.md).
- **Tab icons**: `MaterialCommunityIcons` (outline when inactive, solid when focused) + animated vertical lift.
- **`Settings` tab** is not a single screen: it is **`SettingsNavigator`** (native stack: `SettingsHome` → `Sessions`, etc.).

**`CompanySelectionGate`** wraps the tab navigator: if the user has eligible companies but none selected, shows **`CompanyPicker`** until they choose.

---

## 7. Main feature areas (screens)

| Area | Path | Notes |
|------|------|--------|
| Home | `src/screens/home/HomeScreen.tsx` | Welcome card + menu grid; pull-to-refresh → `refreshProfileRole`; no “Home” title in body — [**home.md**](./home.md) |
| Attendance | `src/screens/attendance/AttendanceScreen.tsx` | Punch / methods UI |
| **My Calendar** | `src/screens/report/Calendar.tsx` | Monthly attendance grid, `/shifts/my-calendar`; see [**my-calendar.md**](./my-calendar.md) |
| Settings | `src/screens/settings/SettingsScreen.tsx` | Menu sections → profile, sessions, **calendar**, language, theme, sign out |
| Sessions | `src/screens/settings/SessionScreen.tsx` | Custom compact header (no native stack header gap); active sessions, Nominatim geocode, logout one / logout others |

---

## 8. API layer (`src/api/`)

- **`authHttpClient.ts`**: Axios instance with `baseURL: API_ENDPOINT`, Bearer from `AuthContext` ref, 401 handler.
- Examples: `requestLoginOtp`, `verifyLoginOtp`, `fetchProfileRole`, `fetchMyCalendar`, `fetchMyLeaveBalance`, `fetchCompanyList`, `createCompany`, `fetchActiveSessions`, `logoutSession`, `logoutAllOtherSessions`, `nominatimReverseGeocode` (external OSM; User-Agent + rate limit).
- **Company header**: many routes send **`company: String(companyId)`** for the **selected** workspace — see [**theme-api.md**](./theme-api.md). **`GET /company/list`** and **`POST /company/create`** use Bearer only (no `company` header). Details: [**company.md**](./company.md).

Types for responses live in **`src/types/`**.

---

## 9. Cross-cutting patterns

- **Strings**: Prefer **`useTranslation()`** + keys under `src/locales/en.ts` (and mirror in `hi.ts` etc.).
- **Colors**: **`useThemeColors()`** or **`useAppTheme()`** when you need `resolvedScheme` (e.g. subtle surfaces).
- **Errors from axios**: **`readApiError`** (`src/utils/readApiError.ts`) — use for modals, not raw `err.message` (4xx bodies expose `message`).
- **Tab stack screens** (Home / company / settings list): **`TAB_SCREEN_SAFE_AREA_EDGES`** + **`TAB_SCREEN_SCROLL_PADDING_BOTTOM`** in `src/constants/tabScreenLayout.ts` — see [**company.md**](./company.md#tab-layout-home-stack-screens), [**face-enroll.md**](./face-enroll.md#tab-screens--bottom-navigation).
- **Confirm / alert UI**: **`useConfirmAlert`** / **`useStatusAlert`** — see [**alerts.md**](./alerts.md) and [**modals.md**](./modals.md).
- **Profile edit & cache**: [**profile.md**](./profile.md).
- **User/company display helpers**: `src/utils/userDisplay.ts`, `src/utils/profileDisplay.ts`, `src/utils/resolveMediaUrl.ts`.

---

## 10. Native / build notes

- **Android**: `react-native-vector-icons` — `fonts.gradle` + `iconFontNames: ['MaterialCommunityIcons.ttf']` in `android/app/build.gradle`.
- **iOS**: `UIAppFonts` includes `MaterialCommunityIcons.ttf` in `Info.plist`; run **`pod install`** after dependency changes.
- **Signing / Firebase**: Package `in.onesaas.attendance`, debug keystore fingerprints — [**SHA.md**](./SHA.md).

---

## 11. Commands

- `npm start` — Metro  
- `npm run android` / `npm run ios` — run app  
- `npx tsc --noEmit` — Typecheck  
- `npm run lint` — ESLint  

---

*Last aligned with codebase structure: monorepo-style single app under `APP/`, React Native 0.85. Context index includes [SHA.md](./SHA.md).*

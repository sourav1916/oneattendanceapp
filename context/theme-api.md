# One Attendance — Theme & API (`context/theme-api.md`)

Attach when working on **light/dark mode**, **colors**, or **authenticated HTTP**.

---

## Theme

### Files

- **`src/theme/palettes.ts`**: `AppThemeColors` type, **`lightTheme`**, **`darkTheme`** (background, surface, text, primary, border, danger, secondaryButton, overlay).
- **`src/storage/themeStorage.ts`**: AsyncStorage read/write for user preference.
- **`src/context/ThemeContext.tsx`**: **`ThemeProvider`**, **`useAppTheme()`**, **`useThemeColors()`**.

### Behavior

- Preference: **`'light' | 'dark' | 'system'`** (default loaded from storage; `'system'` uses `useColorScheme()`).
- **`resolvedScheme`**: `'light' | 'dark'` — use when a style must branch (e.g. shadow strength, tinted chip backgrounds).
- **`useThemeColors()`**: shorthand for `useAppTheme().colors`.

### User-facing theme UI

- **`src/components/modals/ThemePicker.tsx`** — opened from Settings; calls **`setPreference`** on `ThemeContext`.

### Navigation theme

- **`App.tsx`** merges React Navigation default/dark theme with app **`colors`** so stack/tab chrome matches the app palette.

---

## API client (authenticated)

### File

- **`src/api/authHttpClient.ts`**

### Behavior

- **`axios.create({ baseURL: API_ENDPOINT })`** where **`API_ENDPOINT`** is `src/utils/config.ts` (`https://api-attendance.onesaas.in`). **`APP_PORTAL_URL`** there is the product web app (`https://attendance.onesaas.in`).
- **Request interceptor**: sets `Authorization: Bearer <token>` from **`getAccessToken`** configured at runtime.
- **Response interceptor**: on **401**, runs **`onUnauthorized`** once (typically **`signOut`** from `AuthContext`) so the user returns to the auth stack.

### Rules

- Use **`authHttpClient`** for routes that require login and where **401 means “session invalid”**.
- Use **plain `axios`** (or a separate client) for **login / OTP / register** so a stray 401 does not clear storage mid-flow (see file comment).

### Company header pattern

Many authenticated routes pass the selected company as:

```ts
headers: { company: String(companyId) }
```

Examples: `fetchMyLeaveBalance`, `getCurrentAttendanceStatus`, `fetchEmployeeList`, **`fetchMyCalendar`** (`GET /shifts/my-calendar`). Value comes from **`useAuth().selectedCompany.id`**.

**Exceptions** (Bearer only, no `company` header): **`fetchCompanyList`** (`GET /company/list`), **`createCompany`** (`POST /company/create`). See [**company.md**](./company.md).

### File upload (logos, profile photos)

- **`src/utils/FileUpload.ts`**: `uploadFileToOneSaas` → `https://upload.onesaas.in/api/upload` (multipart `file`, header `key: onedevelopers`). Returns public `url` used in API bodies (e.g. `logo_url`, profile picture).

### Related

- **`src/utils/readApiError.ts`**: normalize thrown axios errors for user-visible messages.
- **`context/my-calendar.md`**: employee self-calendar feature and API details.
- **`context/company.md`**: company list, create company, staff screens.

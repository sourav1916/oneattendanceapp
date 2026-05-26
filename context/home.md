# One Attendance — Home & top bar (`context/home.md`)

Attach when working on **`HomeScreen`**, **`MainTopBar`**, company switcher from the header, or home pull-to-refresh.

---

## Layout

| Piece | File | Notes |
|-------|------|--------|
| Top bar (all tabs) | `src/components/MainTopBar.tsx` | Company title + optional ▼ + profile avatar |
| Home body | `src/screens/home/HomeScreen.tsx` | Welcome card + 3-column menu grid |
| Company gate | `src/components/CompanySelectionGate.tsx` | Wraps tab navigator in `MainNavigator.tsx` |

Home has **no** “Home” page title in the scroll content (removed); branding is in the top bar only.

---

## `MainTopBar`

### Company title

- Shows **`selectedCompany.name`**, or **`COMPANY_DISPLAY_NAME`** (`One Attendance` from `src/utils/config.ts`) when none selected.
- Optional company **logo** (or initials chip) when a company is selected.

### Company switcher arrow (▼)

Shown when **`profileRole != null`** (profile-role has loaded at least once):

| Companies from profile-role | Arrow behavior |
|---------------------------|----------------|
| **One or more** | Opens **`CompanySwitcher`** — list + select workspace |
| **Zero** | Same arrow — opens switcher with empty state + **Create company** (see [**modals.md**](./modals.md)) |

On open, **`refreshProfileRole({ silent: true })`** runs so companies created elsewhere appear.

### Profile avatar (right)

Uses the same sources as Home welcome card — **`src/utils/userDisplay.ts`**:

- `profilePictureFromSources(cachedUserProfile, profileRoleUser)`
- `resolveMediaUrl()` for relative image paths (`src/utils/resolveMediaUrl.ts`)
- Fallback: **`initialsFromDisplayName`**

Tap → **`navigation.navigate('Settings')`** (not Profile directly).

---

## `HomeScreen`

### Welcome card

- Name / email / photo from **`displayNameFromSources`**, **`displayEmailFromSources`**, **`profilePictureFromSources`** (auth + cache + `profileRoleUser`).
- Photo URL should use **`resolveMediaUrl`** when displaying remote paths (top bar does; welcome card uses raw URL from helpers — align if relative URLs fail on home card).

### Pull-to-refresh

- **`RefreshControl`** on main `ScrollView`.
- Calls **`refreshProfileRole({ silent: true })`** to refresh user + companies in auth cache without blocking **`CompanySelectionGate`**.

### Menu grid

Tiles: Attendance (tab), Calendar, Company list, Staff, Leave request, Leave management (coming soon). See **`home.menu.*`** i18n.

---

## i18n (`home.*`)

| Key area | Use |
|----------|-----|
| `home.companySwitcher.*` | Switcher title, empty state, create button |
| `home.menu.*` | Grid tile labels |
| `home.welcomeEyebrow`, `home.greeting`, `home.guest` | Welcome card |

---

## Related docs

- [**company.md**](./company.md) — `CompanyList`, `POST /company/create`
- [**modals.md**](./modals.md) — `CompanySwitcher`, `CreateCompany`
- [**profile.md**](./profile.md) — profile-role cache, avatar upload
- [**alerts.md**](./alerts.md) — `StatusAlert` on create-from-switcher success

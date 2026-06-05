# One Attendance — Companies (`context/company.md`)

Attach when working on **company list**, **create company**, **employee management** under `src/screens/company/`, or company-related APIs.

---

## Overview

Users can browse companies they have access to, create new companies, and manage employees from the **Home** tab. Company **selection** for the active workspace uses **`CompanyPicker`** (gate), **`CompanySwitcher`** (top bar), and **`CompanySelectionGate`** — see [**modals.md**](./modals.md), [**home.md**](./home.md).

| Feature | Screen / UI | API |
|---------|-------------|-----|
| List + search | `CompanyList.tsx` | `GET /company/list` |
| Create | `CreateCompany` modal | `POST /company/create` |
| Create (no companies yet) | **`CompanySwitcher`** empty state → `CreateCompany` | Same API + `refreshProfileRole` |
| Employee hub | `EmployeeManagement.tsx` | (sub-routes) |
| Employee list | `EmployeeList.tsx` | `GET /employees/list` (+ `company` header) |
| **Leave hub** | **`LeaveManagement.tsx`** | → **`LeaveRequests`** (live); see [**leave-management.md**](./leave-management.md) |
| Attendance mgmt | `AttendanceManagement.tsx` | Company attendance list + bulk approve |
| Face enrollment | `FaceEnroll.tsx` | `/employees/face-enroll/*` — see [**face-enroll.md**](./face-enroll.md) |

---

## Navigation

- **Home** grid tile **Company** → `navigation.navigate('CompanyList')` (`HomeStackParamList.CompanyList`).
- **Employee Management** tile → `EmployeeManagement` → **Employee list** → `EmployeeList`.

Defined in **`src/navigation/types.ts`** and **`src/navigation/HomeNavigator.tsx`**. See [**navigation.md**](./navigation.md).

---

## Company list (`src/screens/company/CompanyList.tsx`)

### API — `fetchCompanyList` (`src/api/fetchCompanyList.ts`)

- **`GET /company/list`**
- **Auth**: Bearer only (no `company` header — lists the user’s companies).
- **Query**: `page`, `limit` (default 20), optional `search`.

Response shape: `success`, `message`, `data[]`, `meta` (`page`, `limit`, `total`, `total_pages`, `is_last_page`). Types: **`src/types/companyList.ts`**.

### UI behavior

- Custom stack header: back, title **Companies**, **Create** label + `+` → opens modal.
- Debounced search (450 ms), pull-to-refresh, infinite scroll (`onEndReached`).
- Row: logo (or initials), name, legal name, location, active/inactive pill, attendance methods, currency.
- Logo URLs: absolute `http(s)://` or relative paths prefixed with **`API_ENDPOINT`**.

### After create

- **`useConfirmAlert`** success dialog; **`loadFirst()`** refreshes the list.
- Errors from create stay in modal; list errors use retry UI.

---

## Create company (`src/components/modals/CreateCompany.tsx`)

### API — `createCompany` (`src/api/createCompany.ts`)

- **`POST /company/create`**
- **Auth**: Bearer only.
- **Body** (`src/types/createCompany.ts`):

| Field | Required | Notes |
|-------|----------|--------|
| `name` | Yes | Display name, max 255 chars |
| `legal_name` | No | Omitted when empty |
| `logo_url` | No | Public URL from upload service |

Address / coordinates are **not** sent by the app.

Example:

```json
{
  "name": "Techf Corp n",
  "legal_name": "Tech Corporation Pvt Ltd",
  "logo_url": "https://api-attendance.onesaas.in/uploads/images/2026/image-….jpg"
}
```

Response: `{ "success": true, "message": "Company created successfully" }`.

### Logo upload

Same as profile photo: **`launchImageLibrary`** → **`uploadFileToOneSaas`** (`src/utils/FileUpload.ts`, `https://upload.onesaas.in/api/upload`). Uploaded URL is stored and sent as `logo_url` on submit. Create is blocked while upload is in progress or after a failed pick until retry/remove.

### Modal layout

- **Fixed header**: title only (does not scroll).
- **Scrollable body**: logo block, name, legal name, free-creation info hint, validation error.
- **Fixed footer**: Cancel + Create.
- **Create** disabled until: trimmed `name` present, length ≤ 255, logo not uploading, no stuck pending logo file. Cancel stays enabled except during submit.
- **Keyboard**: sheet moves to top and shrinks above keyboard (same idea as **`CountryCodePicker`**); focused field scrolls into view. See [**modals.md**](./modals.md).

### i18n

Keys under **`home.companyList`** and **`home.companyList.createModal`** in `src/locales/en.ts` (and `hi.ts` for Hindi; others fall back to English).

---

## Employee management (related)

- **`EmployeeManagement.tsx`**: menu hub (add employee, employee list, face enrollment, etc.; some items “coming soon”).
- **`LeaveManagement.tsx`**: menu hub for company leave admin — **Leave requests** navigates to **`LeaveRequests.tsx`**; create leave, balances, policies, reports → coming soon.
- **`LeaveRequests.tsx`**: manager list from **`GET /leave/emp-leaves`**; approve / reject / bulk; requires **`LEAVE.MNG`** — full detail in [**leave-management.md**](./leave-management.md).
- **`EmployeeList.tsx`**: paginated employees; requires **`useAuth().selectedCompany`** and sends **`company`** header — see [**theme-api.md**](./theme-api.md).
- **Face enrollment**: [**face-enroll.md**](./face-enroll.md) — list, capture, upload image URL, enroll/check/delete APIs.

Do not confuse **company list** (all companies for the user) with **employee list** (employees of the **selected** company).

---

## Tab layout (Home stack screens)

Company screens sit in **`HomeNavigator`** above the bottom tab bar. Use the same safe-area pattern as **`SettingsScreen`**:

- **`TAB_SCREEN_SAFE_AREA_EDGES`** = `['top', 'left', 'right']` only — **not** `'bottom'`.
- List/scroll **`paddingBottom: 32`** via **`TAB_SCREEN_SCROLL_PADDING_BOTTOM`**.

Defined in **`src/constants/tabScreenLayout.ts`**. `MainNavigator` already applies bottom inset on the tab bar (`safeAreaInsets={{ bottom: 0 }}`); adding `bottom` to `SafeAreaView` causes a large empty gap.

**Applied to:** `CompanyList`, `EmployeeManagement`, `EmployeeList`, `FaceEnrollList`, `AttendanceManagement`, `CompanyInvites`, `InvitePackages`, `PermissionManagement`, `EmployeeProfile`, etc.

**Exceptions:** full-screen modals (`OnboardEmployeeModal`, …) may keep `bottom` edge; `FaceEnrollCapture` uses camera-specific edges (`top` + `bottom` for capture UI).

---

## File map

```
src/
├── api/
│   ├── fetchCompanyList.ts
│   └── createCompany.ts
├── components/modals/
│   └── CreateCompany.tsx
├── constants/
│   └── tabScreenLayout.ts
├── screens/company/
│   ├── CompanyList.tsx
│   ├── EmployeeManagement.tsx
│   ├── EmployeeList.tsx
│   ├── FaceEnroll.tsx
│   ├── LeaveManagement.tsx
│   ├── LeaveRequests.tsx
│   └── … (AttendanceManagement, Invites, Permissions, CompanyLedger, …)
├── screens/home/
│   └── HomeScreen.tsx          # Company tile → CompanyList
└── types/
    ├── companyList.ts
    └── createCompany.ts
```

---

## Company switcher vs company list

| Entry | When | After create |
|-------|------|----------------|
| **CompanyList** | Home → Company tile | `loadFirst()` refreshes paginated list; `ConfirmAlert` success |
| **CompanySwitcher** | MainTopBar ▼ (especially zero companies) | `refreshProfileRole`; `selectCompany`; `StatusAlert` success |

---

## Related context

- [**home.md**](./home.md) — MainTopBar, pull-to-refresh
- [**modals.md**](./modals.md) — `CompanySwitcher`, `CreateCompany`, sheet patterns
- [**alerts.md**](./alerts.md) — `StatusAlert` / `ConfirmAlert` after create
- [**navigation.md**](./navigation.md) — `HomeStackParamList`.
- [**face-enroll.md**](./face-enroll.md) — capture, upload, enroll/check APIs.
- [**leave-management.md**](./leave-management.md) — manager leave list, approve-edit, reject, bulk.
- [**theme-api.md**](./theme-api.md) — `authHttpClient`, `company` header on employee routes.

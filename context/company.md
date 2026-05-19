# One Attendance — Companies (`context/company.md`)

Attach when working on **company list**, **create company**, **staff management** under `src/screens/company/`, or company-related APIs.

---

## Overview

Users can browse companies they have access to, create new companies, and manage staff from the **Home** tab. Company **selection** for the active workspace (top bar) is separate: see **`CompanyPicker`** / **`CompanySwitcher`** in [**modals.md**](./modals.md) and **`CompanySelectionGate`**.

| Feature | Screen / UI | API |
|---------|-------------|-----|
| List + search | `CompanyList.tsx` | `GET /company/list` |
| Create | `CreateCompany` modal | `POST /company/create` |
| Staff hub | `StaffManagement.tsx` | (sub-routes) |
| Staff list | `StaffList.tsx` | `GET /employees/list` (+ `company` header) |

---

## Navigation

- **Home** grid tile **Company** → `navigation.navigate('CompanyList')` (`HomeStackParamList.CompanyList`).
- **Staff Management** tile → `StaffManagement` → **Staff list** → `StaffList`.

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

## Staff management (related)

- **`StaffManagement.tsx`**: menu hub (add staff, staff list, etc.; some items “coming soon”).
- **`StaffList.tsx`**: paginated employees; requires **`useAuth().selectedCompany`** and sends **`company`** header — see [**theme-api.md**](./theme-api.md).

Do not confuse **company list** (all companies for the user) with **staff list** (employees of the **selected** company).

---

## File map

```
src/
├── api/
│   ├── fetchCompanyList.ts
│   └── createCompany.ts
├── components/modals/
│   └── CreateCompany.tsx
├── screens/company/
│   ├── CompanyList.tsx
│   ├── StaffManagement.tsx
│   └── StaffList.tsx
├── screens/home/
│   └── HomeScreen.tsx          # Company tile → CompanyList
└── types/
    ├── companyList.ts
    └── createCompany.ts
```

---

## Related context

- [**modals.md**](./modals.md) — sheet patterns, scroll indicators, keyboard-aware forms.
- [**alerts.md**](./alerts.md) — `ConfirmAlert` after successful create.
- [**navigation.md**](./navigation.md) — `HomeStackParamList`.
- [**theme-api.md**](./theme-api.md) — `authHttpClient`, `company` header on employee routes.

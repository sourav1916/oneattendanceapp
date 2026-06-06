# One Attendance — Leave management (`context/leave-management.md`)

Attach when working on **manager leave hub**, **leave requests**, **leave balances**, **leave types (config)**, or employee **my leaves** (`LeaveRequest`).

---

## Overview

| Audience | Screen | Route | Permission / notes |
|----------|--------|-------|-------------------|
| **Employee** | `LeaveRequest.tsx` | `Home` → `LeaveRequest` | Own applications + balances (`/leave/my-applications`, `/leave/apply`, …) |
| **Manager** | `LeaveManagement.tsx` | `Home` → `LeaveManagement` | Hub menu — create leave, requests, balances, leave types |
| **Manager** | `LeaveRequests.tsx` | `LeaveManagement` → `LeaveRequests` | **`LEAVE.MNG`** — list + approve/reject team requests |
| **Manager** | `LeaveBalance.tsx` | `LeaveManagement` → `LeaveBalance` | Employee leave balances — assign / update / delete |
| **Manager** | `LeaveConfig.tsx` | `LeaveManagement` → `LeaveConfig` | Company leave types — create / edit / delete |

Home tile **Leave Management** → `navigation.navigate('LeaveManagement')`. See [**home.md**](./home.md).

---

## Navigation

**`HomeStackParamList`** (`src/navigation/types.ts`):

- `LeaveRequest` — employee self-service
- `LeaveManagement` — company hub
- `LeaveRequests` — manager request list
- `LeaveBalance` — manager balance CRUD
- `LeaveConfig` — manager leave-type CRUD

Registered in **`src/navigation/HomeNavigator.tsx`**. Hub pattern matches **`EmployeeManagement.tsx`** (menu card rows).

---

## Leave Management hub (`LeaveManagement.tsx`)

Menu items (i18n `home.leaveManagement.items.*`):

| id | Action | Status |
|----|--------|--------|
| `create` | Opens **`CreateManagementLeaveModal`** on hub | **Live** |
| `requests` | `navigation.navigate('LeaveRequests')` | **Live** |
| `balances` | `navigation.navigate('LeaveBalance')` | **Live** |
| `configs` | `navigation.navigate('LeaveConfig')` | **Live** |

**Removed** from hub: policies, reports (no menu rows).

Hub loads **`attendanceApi.fetchLeaveConfigs`** for the create-leave modal chip picker (`LeaveConfigEntry[]`).

---

## Leave types — config CRUD (`LeaveConfig.tsx`)

### API

| Action | Method | Endpoint | Notes |
|--------|--------|----------|-------|
| List | GET | `/leave/company` | Query: `page`, `limit` (max 100), `search`, `is_active`, `is_paid` |
| Create | POST | `/leave/create` | 201; response has `message` only — refetch list |
| Update | PUT | `/leave/update` | Partial fields incl. `is_active` |
| Delete | DELETE | `/leave/delete` | Body `{ id }`; only if type never used |

**Auth**: Bearer + **`company: String(companyId)`** header.  
**Hook**: `useLeaveConfigs` (`src/hooks/useLeaveConfigs.ts`) — search, active/paid filters, pagination, 403 → `accessDenied`.  
**Types**: `src/types/leaveConfig.ts`.

### UI

- Colorful card list (search, active/paid filter chips, pagination).
- Header **+** button → create modal.
- Per-card **Edit** / **Delete** (delete only when allowed).
- **`ConfirmAlert`** before create/update/delete; **`StatusAlert`** for outcomes.

### Modal — `LeaveConfigFormModal.tsx`

Keyboard-aware bottom sheet — see [**modals.md** → Keyboard-aware bottom sheets](./modals.md#keyboard-aware-bottom-sheets-fixed-header--scroll-body--footer).

**Create defaults** (when opening fresh form):

| Field | Default |
|-------|---------|
| `is_paid` | `true` |
| `allow_half_day` | **`false`** |
| `carry_forward_limit` | `0` |
| `exclude_weekends` | `true` |
| `is_active` | `true` (create only; edit loads from API) |

**i18n**: `home.leaveConfig.*`, `home.leaveConfig.formModal.*`

---

## Leave balances (`LeaveBalance.tsx`)

### API

| Action | Method | Endpoint | Notes |
|--------|--------|----------|-------|
| List | GET | `/leave/emp-balances` | Query: `year`, `page`, `limit` (max 50), `search` |
| Assign | POST | `/leave/assign-balance` | `{ employee_id, leaves: [{ leave_config_id, total_allocated }] }` |
| Update | PUT | `/leave/update-balance` | `{ employee_id, leaves: [{ leave_config_id, total_allocated }] }` |
| Delete | DELETE | `/leave/delete-balance` | `{ employee_id, leave_config_id }` |

**Hook**: `useEmpLeaveBalances` (`src/hooks/useEmpLeaveBalances.ts`) — normalizes numeric fields from API strings via **`formatLeaveDays`** / **`coerceLeaveDays`**.  
**Types**: `src/types/empLeaveBalance.ts`.

### UI

- Year selector + search + pagination.
- Per-employee expandable cards with leave-type rows (allocated / used / remaining).
- **Assign** (per employee or header) → **`AssignLeaveBalanceModal`**.
- Per-row **Edit** → **`UpdateLeaveBalanceModal`**; **Delete** → **`ConfirmAlert`**.
- Loads leave config chips from **`attendanceApi.fetchLeaveConfigs`** for assign modal.

### Modals

| Modal | Keyboard pattern | Purpose |
|-------|------------------|---------|
| **`AssignLeaveBalanceModal.tsx`** | Bottom-sheet listeners — [**modals.md**](./modals.md) | Pick employee (unless preselected), multi-row type + allocated days |
| **`UpdateLeaveBalanceModal.tsx`** | Same | Edit `total_allocated`; validates ≥ used, ≤ max_balance |

**i18n**: `home.leaveBalances.*`

---

## Leave Requests — manager list (`LeaveRequests.tsx`)

### API — list

**`leaveApi.getEmpLeaves`** → **`GET /leave/emp-leaves`**

- **Auth**: Bearer + **`company: String(companyId)`** header
- **Permission**: `LEAVE.MNG` (403 → access-denied message, no retry)
- **Query** (all optional): `page` (default 1), `limit` (default 20, max 50), `search`, `status`, `start_date`, `end_date`
- **Status filter values**: `pending`, `approved`, `rejected` only — **no `cancelled`** chip; API does not return cancelled rows
- **Search**: case-insensitive AND across name, email, code, leave name/code, reason
- **Date range**: `DateRangePicker` (same pattern as **`Ledger.tsx`**) — filters leave **start_date**

**Hook**: `useEmpLeaves` (`src/hooks/useEmpLeaves.ts`) — debounced search, pagination, pull-to-refresh.

**Types**: `src/types/employeeLeave.ts` (`EmployeeLeaveRow`, `EmpLeaveListMeta`, …).

### UI — list cards (compact)

Each row shows: avatar, name, code, status badge, leave type, dates + days.

**Pending only** — card footer:

- Checkbox (multi-select for bulk)
- **Quick approve** — `{ id }` only → `approve-edit` (with `ConfirmAlert` first)
- **Reject** — opens reject modal

Tap card body → **`EmpLeaveDetailModal`**.

**Bulk bar** (when selection non-empty): floating bottom bar with extra list `paddingBottom` (+80px) so last row checkbox is not covered. Actions: **Bulk action** (selected IDs), **All pending** (when status filter = pending, `ids: "all"`).

Hub also hosts **`CreateManagementLeaveModal`** for manager-created leaves (same modal as hub **Create leave** item).

### UI — detail modal (`EmpLeaveDetailModal.tsx`)

Fixed layout (do **not** use `flex: 1` on middle `ScrollView` without height — use **`maxHeight`** on scroll body):

- **Header** (fixed): title + employee photo / name / code
- **Body** (scroll): email, designation, leave type, dates, reason, status, approval info, attachments (`resolveMediaUrl`)
- **Footer** (fixed): pending actions + Close

**Pending actions**:

| Button | Behavior |
|--------|----------|
| **Edit & approve** | Opens **`ApproveLeaveModal`** (dates, half-day, then approve) |
| **Approve** | Quick approve as-is (`ConfirmAlert` → `{ id }`) |
| **Reject** | `ConfirmAlert` → **`RejectLeaveModal`** |

All destructive/API actions use **`ConfirmAlert`** before submit; success/errors via **`StatusAlert`**.

---

## Manager action APIs (`src/api/leaveApi.ts`)

Types: **`src/types/leaveManagement.ts`**, **`src/types/leaveConfig.ts`**, **`src/types/empLeaveBalance.ts`**.  
Payload builder: **`src/utils/leaveApprovePayload.ts`**.

### `PUT /leave/management/approve-edit` — `leaveApi.approveEdit`

**Only for `pending` leaves.** Cannot edit approved/rejected/cancelled.

**Accepted body fields**: `id` (required), optional `start_date`, `end_date`, `is_half_day`, `half_day_type` (`first_half` | `second_half`).

**Not accepted**: `remarks`, `reason`, `leave_config_id`, `employee_id`, etc.

**Payload rules** (`buildApproveEditPayload`):

- No edits → `{ id }` only (quick approve)
- Half-day → must send `is_half_day: true`, `half_day_type`, `start_date` = `end_date`
- Half → full → `is_half_day: false` + changed dates if any

**Response**: original `id` is soft-deleted; use **`data.leave_ids`** (new IDs). `data.balance` for paid leave types.

**Modal**: **`ApproveLeaveModal.tsx`** — bottom sheet; no remarks field.

### `PUT /leave/reject` — `leaveApi.rejectLeave`

Single pending leave; optional `remarks` (max 1000). **`RejectLeaveModal.tsx`**.

### `PUT /leave/management/bulk-approve-reject` — `leaveApi.bulkApproveReject`

`ids: number[] | "all"`, `action: "approve" | "reject"`, optional `remarks` (max 255). All-or-nothing transaction. **`BulkLeaveActionModal.tsx`**.

---

## Modals (`src/components/modals/`)

| Component | Purpose |
|-----------|---------|
| **`EmpLeaveDetailModal.tsx`** | Manager leave detail; fixed header/footer + scroll body |
| **`ApproveLeaveModal.tsx`** | Edit dates / half-day + approve (pending only) |
| **`RejectLeaveModal.tsx`** | Reject one leave with remarks |
| **`BulkLeaveActionModal.tsx`** | Bulk approve or reject selected / all pending |
| **`CreateManagementLeaveModal.tsx`** | Manager: create leave on behalf of employee |
| **`LeaveConfigFormModal.tsx`** | Create/edit leave type — **keyboard-aware bottom sheet** |
| **`AssignLeaveBalanceModal.tsx`** | Assign balance — keyboard-aware bottom sheet |
| **`UpdateLeaveBalanceModal.tsx`** | Update allocated days — keyboard-aware bottom sheet |
| **`DateRangePicker.tsx`** | List date filter (shared with Ledger) |
| **`ConfirmAlert`** / **`StatusAlert`** | Confirm before actions; toast outcomes — [**alerts.md**](./alerts.md) |

Employee-side leave modals: **`ApplyLeave.tsx`**, **`LeaveDetailModal.tsx`** on **`LeaveRequest.tsx`**.

**Bottom-sheet keyboard pattern**: [**modals.md**](./modals.md) — do not use `KeyboardAvoidingView` + listeners together; use conditional `ScrollView` flex.

---

## Utilities

**`src/utils/formatLeaveDays.ts`** — safe formatting when API returns numbers or strings:

- `coerceLeaveDays(value)` → number
- `formatLeaveDays(value)` → display string (no `.toFixed` on non-numbers)

Use in balance/config forms and list cards.

---

## i18n

| Area | Keys |
|------|------|
| Hub | `home.leaveManagement.*` |
| Requests | `home.leaveRequests.*` |
| Balances | `home.leaveBalances.*` |
| Leave types | `home.leaveConfig.*` |
| Employee | `home.leaveRequest.*` (my applications) |

Primary locale: `src/locales/en.ts` (extend `hi`, `ta`, `te` when adding keys).

---

## File map

```
src/
├── api/
│   ├── leaveApi.ts              # emp leaves, balances, configs, approve/reject/bulk
│   └── attendanceApi.ts         # fetchLeaveConfigs (chip picker — lighter type)
├── hooks/
│   ├── useEmpLeaves.ts
│   ├── useEmpLeaveBalances.ts
│   └── useLeaveConfigs.ts
├── types/
│   ├── employeeLeave.ts
│   ├── empLeaveBalance.ts
│   ├── leaveConfig.ts
│   └── leaveManagement.ts
├── utils/
│   ├── leaveApprovePayload.ts
│   └── formatLeaveDays.ts
├── screens/
│   ├── company/
│   │   ├── leave/
│   │   │   ├── LeaveManagement.tsx  # hub + CreateManagementLeaveModal host
│   │   │   ├── LeaveRequests.tsx
│   │   │   ├── LeaveBalance.tsx
│   │   │   └── LeaveConfig.tsx
│   │   └── …
│   └── home/
│       └── LeaveRequest.tsx
└── components/modals/
    ├── EmpLeaveDetailModal.tsx
    ├── ApproveLeaveModal.tsx
    ├── RejectLeaveModal.tsx
    ├── BulkLeaveActionModal.tsx
    ├── CreateManagementLeaveModal.tsx
    ├── LeaveConfigFormModal.tsx
    ├── AssignLeaveBalanceModal.tsx
    └── UpdateLeaveBalanceModal.tsx
```

---

## Related context

- [**home.md**](./home.md) — Home grid tile → `LeaveManagement`
- [**company.md**](./company.md) — tab layout, `EmployeeManagement` hub pattern
- [**navigation.md**](./navigation.md) — `HomeStackParamList` routes
- [**modals.md**](./modals.md) — sheet patterns, keyboard-aware bottom sheets, modal inventory
- [**alerts.md**](./alerts.md) — `ConfirmAlert`, `StatusAlert`
- [**theme-api.md**](./theme-api.md) — `company` header, `authHttpClient`
- [**keyboard-scroll.md**](./keyboard-scroll.md) — full-screen scroll patterns (screens, not modals)

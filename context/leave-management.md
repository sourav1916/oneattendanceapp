# One Attendance — Leave management (`context/leave-management.md`)

Attach when working on **manager leave requests**, **approve/reject**, **leave hub**, or employee **my leaves** (`LeaveRequest`).

---

## Overview

| Audience | Screen | Route | Permission / notes |
|----------|--------|-------|-------------------|
| **Employee** | `LeaveRequest.tsx` | `Home` → `LeaveRequest` | Own applications + balances (`/leave/my-applications`, `/leave/apply`, …) |
| **Manager** | `LeaveManagement.tsx` | `Home` → `LeaveManagement` | Hub menu (most items coming soon) |
| **Manager** | `LeaveRequests.tsx` | `LeaveManagement` → `LeaveRequests` | **`LEAVE.MNG`** — list + actions on team requests |

Home tile **Leave Management** → `navigation.navigate('LeaveManagement')` (no longer “coming soon”). See [**home.md**](./home.md).

---

## Navigation

**`HomeStackParamList`** (`src/navigation/types.ts`):

- `LeaveRequest` — employee self-service
- `LeaveManagement` — company hub
- `LeaveRequests` — manager list

Registered in **`src/navigation/HomeNavigator.tsx`**. Hub pattern matches **`EmployeeManagement.tsx`** (menu card rows + `ConfirmAlert` for coming soon).

---

## Leave Management hub (`LeaveManagement.tsx`)

Menu items (i18n `home.leaveManagement.items.*`):

| id | Navigates | Status |
|----|-----------|--------|
| `requests` | `LeaveRequests` | **Live** |
| `create`, `balances`, `policies`, `reports` | — | Coming soon (`ConfirmAlert`) |

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

Types: **`src/types/leaveManagement.ts`**. Payload builder: **`src/utils/leaveApprovePayload.ts`**.

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
| **`DateRangePicker.tsx`** | List date filter (shared with Ledger) |
| **`ConfirmAlert`** / **`StatusAlert`** | Confirm before actions; toast outcomes — [**alerts.md**](./alerts.md) |

Employee-side leave modals: **`ApplyLeave.tsx`**, **`LeaveDetailModal.tsx`** on **`LeaveRequest.tsx`**.

---

## i18n

Primary keys under **`home.leaveRequests.*`** and **`home.leaveManagement.*`** in `src/locales/en.ts`.

Employee keys remain under **`home.leaveRequest.*`** (my applications screen).

Confirm copy: **`home.leaveRequests.actions.confirm.*`**.

---

## File map

```
src/
├── api/leaveApi.ts              # getEmpLeaves, approveEdit, bulkApproveReject, rejectLeave + employee CRUD
├── hooks/useEmpLeaves.ts
├── types/
│   ├── employeeLeave.ts         # list row + meta
│   └── leaveManagement.ts       # approve/reject/bulk payloads + responses
├── utils/leaveApprovePayload.ts # buildApproveEditPayload
├── screens/
│   ├── company/
│   │   ├── LeaveManagement.tsx  # hub
│   │   └── LeaveRequests.tsx    # manager list + actions
│   └── home/
│       └── LeaveRequest.tsx     # employee my leaves
└── components/modals/
    ├── EmpLeaveDetailModal.tsx
    ├── ApproveLeaveModal.tsx
    ├── RejectLeaveModal.tsx
    └── BulkLeaveActionModal.tsx
```

---

## Related context

- [**home.md**](./home.md) — Home grid tile → `LeaveManagement`
- [**company.md**](./company.md) — tab layout, `EmployeeManagement` hub pattern
- [**navigation.md**](./navigation.md) — `HomeStackParamList` routes
- [**modals.md**](./modals.md) — sheet patterns, modal inventory
- [**alerts.md**](./alerts.md) — `ConfirmAlert`, `StatusAlert`
- [**theme-api.md**](./theme-api.md) — `company` header, `authHttpClient`

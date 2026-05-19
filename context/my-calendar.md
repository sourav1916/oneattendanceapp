# One Attendance — Employee attendance calendar (`context/my-calendar.md`)

Attach when working on **My Calendar**, **`/shifts/my-calendar`**, or **`src/screens/report/Calendar.tsx`**.

---

## Feature summary

**My Calendar** shows the logged-in employee’s monthly attendance calendar (self-service). The backend resolves **`employee_id` from the Bearer token** — the app must **never** send `employee_id` in query, body, or UI.

| Entry point | Navigation |
|-------------|------------|
| Home grid → **Calendar** | `Home` tab → `navigation.navigate('MyCalendar')` |
| Settings → Work → **Calendar** | `Settings` tab → `navigation.navigate('MyCalendar')` |

Same screen component is registered on **both** stacks (see `navigation.md`).

---

## Files

| File | Role |
|------|------|
| `src/screens/report/Calendar.tsx` | **`MyCalendarScreen`** — UI, fetch, skeleton, modal |
| `src/api/fetchMyCalendar.ts` | `GET /shifts/my-calendar` |
| `src/types/myCalendar.ts` | Response / day / meta TypeScript types |
| `src/utils/calendarHelpers.ts` | Grid helpers, status colors, month shift |
| `src/locales/en.ts` | Keys under **`home.myCalendar.*`** (fallback for other locales) |

---

## API

### Request

```
GET {API_ENDPOINT}/shifts/my-calendar?year={YYYY}&month={M}
```

**Headers** (via `authHttpClient` + explicit header in `fetchMyCalendar.ts`):

| Header | Source |
|--------|--------|
| `Authorization: Bearer <token>` | `authHttpClient` request interceptor (`AuthContext` token ref) |
| `company: "<companyId>"` | `selectedCompany.id` from `useAuth()` — same pattern as leave balance, attendance, employee list |

**Query params only:** `year`, `month` (1–12). **No `employee_id`.**

### Response shape (high level)

```json
{
  "success": true,
  "message": "...",
  "data": {
    "shift": {
      "start_time", "end_time", "expected_work_minutes", "break_minutes"
    },
    "days": {
      "2026-05-02": {
        "day_status": "present",
        "is_approved", "is_deductible",
        "activities": [[{ "type": "PUNCH_IN", "time", "attendance_method" }, ...]],
        "breaks": [[{ "type": "BREAK_START", ... }]],
        "logs": [{ "log_type", "time", "attendance_method" }]
      }
    },
    "statistics": {
      "expected_work_minutes", "worked_minutes",
      "expected_break_minutes", "break_minutes", "overtime_minutes"
    }
  },
  "meta": {
    "year", "month", "total_days",
    "present", "absent", "leave", "holiday", "weekend",
    "half_day", "not_joined", "upcoming"
  }
}
```

- **`data.days`**: object keyed by **`YYYY-MM-DD`**, not an array.
- Each day has **`day_status`**; optional: `is_approved`, `is_deductible`, `activities`, `breaks`, `logs`, `is_holiday`, `is_leave`.
- Upcoming days may include **`is_holiday`** / **`is_leave`** while `day_status` stays `upcoming` (tappable when details exist).

### Status values

`present` | `absent` | `leave` | `holiday` | `weekend` | `half_day` | `not_joined` | `upcoming`

Colors: `getStatusStyle()` in `src/utils/calendarHelpers.ts`.

### Errors (`Calendar.tsx`)

| Case | Behavior |
|------|----------|
| 401 | `authHttpClient` → `signOut` (no inline message) |
| 400 | API message via `readApiError` |
| 5xx | `home.myCalendar.errors.server` |
| Other | `readApiError` |

Requires **`selectedCompany`**; otherwise shows `home.myCalendar.noCompany`.

---

## Screen behavior (`MyCalendarScreen`)

### Layout

1. **Stack header** — back + title (no native stack header; in-screen bar like Leave Request).
2. **Calendar card** — month prev/next, weekday row (Sun–Sat), **week rows** with **`WEEK_ROW_GAP` (8px)** between rows.
3. **Status legend** — swatches for all statuses.
4. **Shift card** — `data.shift` (start/end, expected work & break minutes).
5. **Statistics card** — `data.statistics` (worked, expected work/break, break taken, overtime).
6. **Monthly summary** — cards from `meta` counts.

### Calendar grid

- Built with `buildCalendarGrid(year, month, days)` then **`chunkCalendarWeeks()`** (7 cells per row, pad last row).
- Columns use **`flex: 1`** (not fixed pixel width) so all 7 days including **Saturday** align under headers.
- Date keys: `formatDateKey(year, month, day)` → `YYYY-MM-DD`.

### Loading UX

- **`showSkeleton = loading && !refreshing`**
- Full-screen spinner **not** used.
- **`CalendarContentSkeleton`**: pulsing placeholders for calendar grid + summary (animated like Attendance/Profile skeletons).
- **Pull-to-refresh**: `RefreshControl` on `ScrollView`; keeps content visible, only `refreshing` flag.

### Day interaction

| Status | Tappable? |
|--------|-----------|
| `not_joined`, `upcoming` (no extra fields) | **No** — plain `View` |
| `not_joined`, `upcoming` with `is_holiday`, `is_leave`, activities, etc. | **Yes** — `hasCalendarDayDetails()` |
| All other statuses | **Yes** — bottom **modal** (status, punches, breaks, logs, holiday, leave) |

Default status when API has no entry for a date: **`upcoming`** (non-clickable).

### Month change

Changing year/month updates state → `load()` in `useEffect` → skeleton while fetching (unless pull-refresh).

---

## Helpers (`src/utils/calendarHelpers.ts`)

| Function | Purpose |
|----------|---------|
| `getMonthDays(year, month)` | Days in month |
| `getFirstDayOffset(year, month)` | Sunday-first empty cells before day 1 |
| `formatMonthTitle(year, month)` | e.g. `May 2026` |
| `formatDateKey(year, month, day)` | `YYYY-MM-DD` |
| `getStatusStyle(status)` | Background / text / border colors |
| `buildCalendarGrid(year, month, days)` | Flat cell array |
| `shiftMonth(year, month, delta)` | Prev/next month navigation |
| `formatStatusLabel(status)` | UI label from snake_case |

---

## i18n

English keys: **`src/locales/en.ts`** → `home.myCalendar` (title, loading, summary labels, modal fields, errors).

Other locale files may fall back to English via `fallbackLng: 'en'` in `src/i18n/index.ts`.

---

## Navigation types

- **`HomeStackParamList`**: `MyCalendar: undefined`
- **`SettingsStackParamList`**: `MyCalendar: undefined`

Component props union:

```ts
NativeStackScreenProps<HomeStackParamList, 'MyCalendar'>
  | NativeStackScreenProps<SettingsStackParamList, 'MyCalendar'>
```

---

## Do not

- Add **`employee_id`** to requests, state, or UI for this feature.
- Use **`company_id`** header for this endpoint — backend expects **`company`** (string id), consistent with other authenticated APIs.
- Use plain **`axios`** for this route if 401 should sign the user out — use **`authHttpClient`**.

---

## Related context

- `context/theme-api.md` — Bearer + 401 rules
- `context/navigation.md` — Home / Settings stacks
- `context/Main.md` — project overview + index

---

*Last updated: My Calendar feature (report screen, API, skeleton loading, week gaps, non-clickable upcoming/not_joined, shift card removed from main view).*

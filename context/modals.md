# One Attendance — Modals (`context/modals.md`)

Attach when adding or restyling **modal dialogs** (language, theme, company, session details, etc.).

---

## Shared layout pattern (reference: `LanguagePicker`)

**`src/components/modals/LanguagePicker.tsx`** is the canonical **centered sheet**:

- **`Modal`**: `transparent`, `animationType="fade"`, `statusBarTranslucent`.
- **`SafeAreaView`**: `edges={['top','right','left','bottom']}`, background = `colors.overlay`.
- **Backdrop**: full-screen **`Pressable`** → dismiss.
- **Sheet**: wrapper `justifyContent: 'center'`, `paddingHorizontal: 16`; inner card `alignSelf: 'center'`, `maxWidth: 400`, `maxHeight: min(78% window height, 560)`, `borderRadius: 16`, border, `colors.surface`.
- **Footer**: text-style **Cancel** `Pressable` at bottom of sheet.

Other modals that should **feel the same** (e.g. `ThemePicker`, `SessionDetails`) follow this geometry.

---

## Form sheets (fixed header + footer)

**`CreateCompany.tsx`** and **`ApplyLeave.tsx`** use a **taller form sheet** with:

| Region | Behavior |
|--------|----------|
| **Header** | Title (and optional static copy) — **does not scroll** |
| **Body** | `ScrollView` — fields, hints, inline errors |
| **Footer** | Primary/secondary actions — **does not scroll** |

Sheet uses fixed height cap (~520px) and `overflow: 'hidden'` on the card.

**Slide-up bottom sheets** with inputs (leave config, balance assign/update) use the same three regions but a different keyboard + flex recipe — see **Keyboard-aware bottom sheets** below.

---

## Keyboard-aware centered sheets

When a **centered** form has **`TextInput`** fields, do **not** combine `KeyboardAvoidingView` with `behavior="height"` on Android and `automaticallyAdjustKeyboardInsets` on the same `ScrollView` — that causes flicker on dismiss.

**Preferred pattern** (see **`CountryCodePicker.tsx`**, **`ChangeEmailModal.tsx`**, **`CreateCompany.tsx`**):

1. Listen to `keyboardWillShow` / `keyboardDidShow` and hide events; track **`keyboardHeight`**.
2. While keyboard is open: `sheetWrap` uses `justifyContent: 'flex-start'`, `paddingTop: topInset + 8`, and **reduce sheet height** so the bottom sits above the keyboard (stay on screen).
3. While closed: center the sheet again (`justifyContent: 'center'`).
4. On input **`onFocus`**, `scrollTo` the field’s Y offset inside the body scroll.

---

## Keyboard-aware bottom sheets (fixed header + scroll body + footer)

Use this for **slide-up bottom sheets** with `TextInput` fields — e.g. **`LeaveConfigFormModal.tsx`**, **`AssignLeaveBalanceModal.tsx`**, **`UpdateLeaveBalanceModal.tsx`**.

### Layout regions

```
┌─────────────────────────┐
│ handle                  │
├─────────────────────────┤
│ header (title/subtitle) │  ← fixed, does not scroll
├─────────────────────────┤
│ ScrollView (body)       │  ← fields, switches, inline errors
├─────────────────────────┤
│ footer (Cancel/Confirm) │  ← fixed, does not scroll
└─────────────────────────┘
```

### What **not** to stack

Do **not** combine any of these on the same modal — they fight each other and cause flicker or a collapsed body:

| Avoid | Why |
|-------|-----|
| `KeyboardAvoidingView` + keyboard listeners | Double layout shift on show/hide |
| `automaticallyAdjustKeyboardInsets` on `ScrollView` + listeners | Same |
| `ScrollView` with `flex: 1` when sheet has only `maxHeight` | Body collapses to **0 height** — only header + footer visible |

Use **keyboard listeners only** for bottom sheets.

### Conditional `ScrollView` flex (critical)

The sheet has two layout modes:

| Keyboard | Sheet size | `ScrollView` style |
|----------|------------|-------------------|
| **Closed** | `maxHeight` only — sizes to content | `{ flexGrow: 0, flexShrink: 1 }` |
| **Open** | explicit `height` from `resolveSheetLayout` | `{ flex: 1, minHeight: 0 }` |

```tsx
scroll: { flexGrow: 0, flexShrink: 1 },
scrollKeyboardOpen: { flex: 1, minHeight: 0 },

<ScrollView
  style={[styles.scroll, keyboardHeight > 0 && styles.scrollKeyboardOpen]}
  ...
/>
```

### `resolveSheetLayout` helper

Copy/adapt this pure function per modal (tweak `MIN_SHEET_HEIGHT` / max ratio as needed):

```tsx
const KEYBOARD_GAP = 8;
const MIN_SHEET_HEIGHT = 280;

function resolveSheetLayout(
  windowHeight: number,
  keyboardHeight: number,
  topInset: number,
): { wrapStyle: ViewStyle; sheetHeight?: number; sheetMaxHeight: number } {
  const keyboardOpen = keyboardHeight > 0;
  const sheetMaxHeight = Math.min(windowHeight * 0.92, windowHeight - topInset - 24);

  if (keyboardOpen) {
    const available = windowHeight - keyboardHeight - KEYBOARD_GAP - topInset;
    const sheetHeight = Math.max(MIN_SHEET_HEIGHT, Math.min(sheetMaxHeight, available));
    return {
      wrapStyle: { justifyContent: 'flex-end', paddingTop: 24, paddingBottom: keyboardHeight },
      sheetHeight,
      sheetMaxHeight,
    };
  }

  return {
    wrapStyle: { justifyContent: 'flex-end', paddingTop: 48, paddingBottom: 0 },
    sheetMaxHeight,
  };
}
```

### Wiring checklist

1. **`useWindowDimensions()`** + **`useSafeAreaInsets()`** — feed into `resolveSheetLayout`.
2. **`keyboardHeight` state** — set from listeners while `visible`; reset to `0` on dismiss.
3. **Events**: iOS `keyboardWillShow` / `keyboardWillHide`; Android `keyboardDidShow` / `keyboardDidHide`.
4. **`sheetWrap`**: `[styles.sheetWrap, layout.wrapStyle]` — do not hard-code `paddingBottom` for keyboard elsewhere.
5. **`sheet`**: `maxHeight: layout.sheetMaxHeight`; add `height: layout.sheetHeight` only when keyboard is open. Sheet needs `flexDirection: 'column'` + `overflow: 'hidden'`.
6. **`SafeAreaView`**: `edges={['top']}` on the overlay (bottom inset goes in scroll `paddingBottom`).
7. **`ScrollView`**: `keyboardShouldPersistTaps="handled"`, `keyboardDismissMode="on-drag"`, `showsVerticalScrollIndicator={keyboardHeight > 0}`, `bounces={false}`.
8. **Lower fields**: optional `scrollRef` + `scrollToEnd({ animated: true })` in `onFocus` via `requestAnimationFrame`.

### Reference implementations

| Modal | Notes |
|-------|-------|
| **`LeaveConfigFormModal.tsx`** | Create/edit leave type — canonical bottom-sheet keyboard pattern |
| **`AssignLeaveBalanceModal.tsx`** | Assign balance — same pattern, multi-row inputs |
| **`UpdateLeaveBalanceModal.tsx`** | Update balance — same pattern, single input |
| **`CreateManagementLeaveModal.tsx`** | Uses `KeyboardAvoidingView` only (no listeners) — OK for its height; prefer listener pattern for new modals with inputs |

When creating a new bottom-sheet modal with inputs, attach **`context/modals.md`** and point to the **Keyboard-aware bottom sheets** section above.

---

## Scroll indicators

On every modal **`ScrollView`** and **`FlatList`**, set:

```tsx
showsVerticalScrollIndicator={false}
showsHorizontalScrollIndicator={false}
```

---

## Modal inventory (`src/components/modals/`)

| Component | Purpose |
|-----------|---------|
| **`LanguagePicker.tsx`** | Pick app language from `SUPPORTED_LANGUAGES`; persists + `i18n.changeLanguage`. |
| **`ThemePicker.tsx`** | Pick light / dark / system theme; layout aligned with `LanguagePicker`. |
| **`CompanySwitcher.tsx`** | Company list from profile-role ( **`MainTopBar`** ); empty state + **Create company** — see below. |
| **`CompanyPicker.tsx`** | Full-screen style picker used by **`CompanySelectionGate`**. |
| **`CountryCodePicker.tsx`** | Login/register country dial code; search + keyboard-aware sheet. |
| **`ApplyLeave.tsx`** | Employee leave application form (`LeaveRequest` screen). |
| **`LeaveDetailModal.tsx`** | Employee leave application detail. |
| **`EmpLeaveDetailModal.tsx`** | Manager leave request detail (fixed header/footer + scroll body). |
| **`ApproveLeaveModal.tsx`** | Manager: edit dates / half-day + approve pending (`PUT /leave/management/approve-edit`). |
| **`RejectLeaveModal.tsx`** | Manager: reject one pending leave (`PUT /leave/reject`). |
| **`BulkLeaveActionModal.tsx`** | Manager: bulk approve/reject (`PUT /leave/management/bulk-approve-reject`). |
| **`DateRangePicker.tsx`** | Date range filter (Ledger, Leave Requests). |
| **`CreateCompany.tsx`** | Create company (`POST /company/create`); logo upload, fixed header/footer — see [**company.md**](./company.md). |
| **`SessionDetails.tsx`** | Read-only session info; Nominatim `display_name` for location. |
| **`AttendanceSwipeConfirmModal.tsx`** | Swipe-to-confirm punch actions. |
| **`ConfirmAlert.tsx`** | Generic confirm / alert dialog — see [**alerts.md**](./alerts.md). |
| **`StatusAlert.tsx`** | Success / error / warning / info with themed icon header — see [**alerts.md**](./alerts.md). |
| **`LeaveConfigFormModal.tsx`** | Create/edit company leave type (`POST/PUT /leave/*`); keyboard-aware bottom sheet — see **Keyboard-aware bottom sheets** above. |
| **`AssignLeaveBalanceModal.tsx`** | Assign leave balance to employee (`POST /assign-balance`). |
| **`UpdateLeaveBalanceModal.tsx`** | Update allocated days on existing balance (`PUT /update-balance`). |
| **`CreateManagementLeaveModal.tsx`** | Manager: create leave on behalf of employee. |

---

## `CompanySwitcher` + create company

**`src/components/modals/CompanySwitcher.tsx`** — opened from **`MainTopBar`** (▼ next to company / “One Attendance” title).

### When it opens

- **`refreshProfileRole({ silent: true })`** while visible (spinner in title row).
- Companies from **`companiesFromProfileRole(profileRole?.data?.companies)`**.

### With companies

- Subtitle: “Tap one to switch the active workspace.”
- Tap row → **`onSelectCompany`** + close.

### Empty list (no companies on profile-role)

- Short copy only: **`home.companySwitcher.emptyTitle`** (“No companies yet”).
- **Create company** button — no long hint paragraphs.
- **Do not** reset **`createOpen`** when switcher `visible` becomes `false` (that prevented **`CreateCompany`** from opening). Only clear **`createOpen`** on **`CreateCompany` `onDismiss`**.

### Create company flow

1. User taps **Create company** → `setCreateOpen(true)` then **`onClose()`** (switcher closes).
2. **`CreateCompany`** modal opens (sibling modal in same component).
3. On submit: **`createCompany`** → **`refreshProfileRole({ silent: true })`** → auto-**`onSelectCompany`** (match by name / first owned) → **`StatusAlert` `presentSuccess`** with API message.
4. Errors: **`StatusAlert` `presentError`**; **`CreateCompany`** stays open for retry.

Also available from **`CompanyList`** header (separate `createOpen` state there).

See [**home.md**](./home.md), [**company.md**](./company.md).

---

## Icons in modals

- App-wide icon set for tabs/home: **MaterialCommunityIcons** (`react-native-vector-icons`).
- Modals that only use **Text** / **Pressable** need no special font setup beyond app defaults.

---

## Implementation tips

- Prefer **`useThemeColors()`** + **`useAppTheme().resolvedScheme`** when the spec calls for light/dark variants (e.g. selected cell tint).
- Keep **`keyboardShouldPersistTaps="handled"`** on inner `ScrollView` when the sheet has tappable rows.
- For **native stack** screens that need less vertical chrome under **`MainTopBar`**, a **custom in-screen header** (like `SessionScreen`) avoids double safe-area padding from `react-native-screens`.
- Image uploads in modals: **`uploadFileToOneSaas`** (`src/utils/FileUpload.ts`) — same as [**Profile**](./profile.md) edit modal.
- Manager leave flows: [**leave-management.md**](./leave-management.md).

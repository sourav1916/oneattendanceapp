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
| **Body** | `ScrollView` with `flex: 1` — fields, hints, inline errors |
| **Footer** | Primary/secondary actions — **does not scroll** |

Sheet uses fixed height cap (~520px) and `overflow: 'hidden'` on the card.

---

## Keyboard-aware centered sheets

When a form has **`TextInput`** fields, do **not** combine `KeyboardAvoidingView` with `behavior="height"` on Android and `automaticallyAdjustKeyboardInsets` on the same `ScrollView` — that causes flicker on dismiss.

**Preferred pattern** (see **`CountryCodePicker.tsx`**, **`CreateCompany.tsx`**):

1. Listen to `keyboardWillShow` / `keyboardDidShow` and hide events; track **`keyboardHeight`**.
2. While keyboard is open: `sheetWrap` uses `justifyContent: 'flex-start'`, `paddingTop: topInset + 8`, and **reduce sheet height** so the bottom sits above the keyboard (stay on screen).
3. While closed: center the sheet again (`justifyContent: 'center'`).
4. Optional: `automaticallyAdjustKeyboardInsets` on iOS only on the body `ScrollView`.
5. On input **`onFocus`**, `scrollTo` the field’s Y offset inside the body scroll.

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
| **`ApplyLeave.tsx`** | Leave application form (from leave balance screen). |
| **`CreateCompany.tsx`** | Create company (`POST /company/create`); logo upload, fixed header/footer — see [**company.md**](./company.md). |
| **`SessionDetails.tsx`** | Read-only session info; Nominatim `display_name` for location. |
| **`AttendanceSwipeConfirmModal.tsx`** | Swipe-to-confirm punch actions. |
| **`ConfirmAlert.tsx`** | Generic confirm / alert dialog — see [**alerts.md**](./alerts.md). |
| **`StatusAlert.tsx`** | Success / error / warning / info with themed icon header — see [**alerts.md**](./alerts.md). |

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

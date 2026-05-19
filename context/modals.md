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
| **`CompanySwitcher.tsx`** | Modal listing companies (used from `MainTopBar`). |
| **`CompanyPicker.tsx`** | Full-screen style picker used by **`CompanySelectionGate`**. |
| **`CountryCodePicker.tsx`** | Login/register country dial code; search + keyboard-aware sheet. |
| **`ApplyLeave.tsx`** | Leave application form (from leave balance screen). |
| **`CreateCompany.tsx`** | Create company (`POST /company/create`); logo upload, fixed header/footer — see [**company.md**](./company.md). |
| **`SessionDetails.tsx`** | Read-only session info; Nominatim `display_name` for location. |
| **`AttendanceSwipeConfirmModal.tsx`** | Swipe-to-confirm punch actions. |
| **`ConfirmAlert.tsx`** | Generic confirm / alert dialog — see [**alerts.md**](./alerts.md). |
| **`StatusAlert.tsx`** | Success / error / warning / info with themed icon header — see [**alerts.md**](./alerts.md). |

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

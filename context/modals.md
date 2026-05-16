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

## Modal inventory (src/components/modals/)

| Component | Purpose |
|-----------|---------|
| **`LanguagePicker.tsx`** | Pick app language from `SUPPORTED_LANGUAGES`; persists + `i18n.changeLanguage`. |
| **`ThemePicker.tsx`** | Pick light / dark / system theme; layout aligned with `LanguagePicker`. |
| **`CompanySwitcher.tsx`** | Modal listing companies (used from `MainTopBar`). |
| **`CompanyPicker.tsx`** | Full-screen style picker used by **`CompanySelectionGate`**. |
| **`SessionDetails.tsx`** | Read-only session info; Nominatim `display_name` for location; same centered sheet pattern as pickers. |
| **`ConfirmAlert.tsx`** | Generic confirm / alert dialog — see **`context/alerts.md`**. |

---

## Icons in modals

- App-wide icon set for tabs/home: **MaterialCommunityIcons** (`react-native-vector-icons`).
- Modals that only use **Text** / **Pressable** need no special font setup beyond app defaults.

---

## Implementation tips

- Prefer **`useThemeColors()`** + **`useAppTheme().resolvedScheme`** when the spec calls for light/dark variants (e.g. selected cell tint).
- Keep **`keyboardShouldPersistTaps="handled"`** on inner `ScrollView` when the sheet has tappable rows.
- For **native stack** screens that need less vertical chrome under **`MainTopBar`**, a **custom in-screen header** (like `SessionScreen`) avoids double safe-area padding from `react-native-screens`.

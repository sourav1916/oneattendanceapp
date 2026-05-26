# One Attendance — Alerts & confirms (`context/alerts.md`)

Attach when implementing **confirmation dialogs**, **success/error feedback**, or **“coming soon”** messages.

---

## Choose the right primitive

| Need | Use |
|------|-----|
| Cancel / confirm, multi-button choices, custom `onPress` | **`ConfirmAlert`** + `useConfirmAlert` |
| Success, error, warning, info with **icon + tone colors** | **`StatusAlert`** + `useStatusAlert` |
| OS permissions | System APIs |
| Lightweight transient toast | Not a shared primitive yet |

Many screens mount **both** when they need confirms and status feedback.

---

## `ConfirmAlert`

**`src/components/modals/ConfirmAlert.tsx`**

- Modal card: title, message, buttons.
- **`childrenPlacement`**: `'aboveTitle'` \| `'betweenTitleAndMessage'` (default) \| `'belowMessage'`.
- Hook: **`useConfirmAlert`** → `<ConfirmAlert {...confirmProps} />`.
- **`present(config)`** — `buttons`, optional `onAfterDismiss`, `closeOnPress` per button.

Nested **`present()`** after async work: **`SessionScreen`** (logout).

---

## `StatusAlert`

**`src/components/modals/StatusAlert.tsx`**

Built on **`ConfirmAlert`** with themed **MaterialCommunityIcons** above the title.

### Tones

| Tone | Icon | Button |
|------|------|--------|
| `success` | `check-circle` | `primary` (green) |
| `error` | `close-circle` | `danger` (red) |
| `warning` | `alert-circle` | `primary` (amber) |
| `info` | `information` | `primary` (blue) |

### Hook

```tsx
const { props: statusAlertProps, presentSuccess, presentError, present, dismiss } =
  useStatusAlert();

<StatusAlert {...statusAlertProps} />
```

- **`presentSuccess` / `presentError`** — omit `tone`; pass **`message`** from API when available.
- **`dismissOnIconPress`** (default `true`) — tap icon to dismiss.
- **`onAfterDismiss`** — e.g. `navigation.goBack()` after profile save.

### Usage map

| Location | Event | Alert |
|----------|-------|--------|
| `EditProfile.tsx` | Save OK | `presentSuccess` (API `message`) |
| `EditProfile.tsx` | Upload fail | `presentError` |
| `EditProfile.tsx` | Remove photo | `ConfirmAlert` |
| `CompanySwitcher.tsx` | Create company OK / fail | `presentSuccess` / `presentError` |
| `CompanyList.tsx` | Create OK | `ConfirmAlert` (legacy) |
| `SettingsScreen.tsx` | Coming soon, sign out | `ConfirmAlert` |

Prefer **`StatusAlert`** for new one-button success/error feedback.

Details: [**profile.md**](./profile.md), [**modals.md**](./modals.md) (`CompanySwitcher`).

---

## i18n

- Generic: **`settings.alerts.*`**
- Profile: **`settings.profile.*`**
- Company switcher empty/create: **`home.companySwitcher.*`**

---

## Related

- [**modals.md**](./modals.md) — modal layout patterns
- [**profile.md**](./profile.md) — edit profile flows

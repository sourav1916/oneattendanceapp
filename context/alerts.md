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

Many screens mount **both** when they need confirms and status feedback (e.g. **Profile** — see [**profile.md**](./profile.md)).

---

## `ConfirmAlert`

**`src/components/modals/ConfirmAlert.tsx`**

- Modal card: title, optional **`children`**, message, buttons.
- **`childrenPlacement`**: `'aboveTitle'` \| `'betweenTitleAndMessage'` (default) \| `'belowMessage'`.
- Props: `visible`, `onDismiss`, `buttons[]`, variants (`primary`, `secondary`, `danger`, `outline`, `ghost`), backdrop/hardware dismiss, `buttonLayout`, etc.
- Types: **`ConfirmAlertProps`**, **`ConfirmAlertButton`**.

### Hook: `useConfirmAlert`

```tsx
const { props: confirmProps, present, dismiss, visible } = useConfirmAlert();

<ConfirmAlert {...confirmProps} />
```

#### `present(config)`

- **`ConfirmAlertPresentConfig`**: merges defaults (`dismissOnBackdropPress: true`, etc.).
- **`buttons`**: `{ text, variant?, onPress?, key?, closeOnPress?, ... }`.
- Optional: **`title`**, **`message`**, **`children`**, **`onAfterDismiss`**.
- Button **`onPress`** runs first; dialog closes when **`closeOnPress !== false`** (default).

#### Typical patterns

**Single OK**

```ts
present({
  title: t('settings.alerts.comingSoonTitle'),
  message: t('settings.alerts.comingSoonMessage'),
  buttons: [{ text: t('settings.alerts.ok'), variant: 'primary' }],
});
```

**Cancel + confirm**

```ts
present({
  title: '…',
  message: '…',
  buttons: [
    { key: 'cancel', text: t('settings.alerts.cancel'), variant: 'secondary' },
    { key: 'ok', text: t('settings.alerts.ok'), variant: 'primary', onPress: () => { void doWork(); } },
  ],
});
```

Nested **`present()`** after async work is used in **`SessionScreen`** (logout flows).

---

## `StatusAlert`

**`src/components/modals/StatusAlert.tsx`**

Built on **`ConfirmAlert`** with a themed **MaterialCommunityIcons** header (icon above title).

### Tones

| Tone | Icon | Button variant |
|------|------|----------------|
| `success` | `check-circle` | `primary` (green ring/glyph) |
| `error` | `close-circle` | `danger` (red) |
| `warning` | `alert-circle` | `primary` (amber) |
| `info` | `information` | `primary` (blue) |

Ring/glyph colors adapt to **`resolvedScheme`** (light/dark).

### Hook: `useStatusAlert`

```tsx
const { props: statusProps, presentSuccess, presentError, presentWarning, presentInfo, present, dismiss } =
  useStatusAlert();

<StatusAlert {...statusProps} />
```

#### Helpers

```ts
presentSuccess({
  title: 'Profile updated',
  message: 'Your profile details were updated successfully.',
  buttonText: 'Done',
  dismissIconA11y: 'Dismiss success message',
});

presentError({
  title: 'Upload failed',
  message: apiMessage,
  buttonText: 'Done',
  dismissIconA11y: 'Dismiss upload error',
});
```

- **`present(config)`** — full config with required **`tone`**.
- **`dismissOnIconPress`** (default `true`): tapping the icon calls **`dismiss`**.
- Optional **`buttons`** override; otherwise single button from **`buttonText`** (default `'OK'`).
- Optional screen-level defaults: `useStatusAlert({ buttonText: t('…') })`.

### Reference: Profile screen

| Event | Alert |
|-------|--------|
| Photo upload success | *(none — silent)* |
| Photo upload failure | `presentError` |
| Profile save success | `presentSuccess` |
| Remove photo | `ConfirmAlert` confirm |

Details: [**profile.md**](./profile.md).

---

## i18n

- Generic copy: **`settings.alerts.*`** (`ok`, `cancel`, coming soon, sign out).
- Feature-specific: **`settings.profile.*`**, **`settings.sessions.*`**, etc.
- Mirror keys in `hi.ts`, `gu.ts`, `bn.ts` when adding new user-facing strings.

---

## Screens using alerts (non-exhaustive)

| Screen | Confirm | Status |
|--------|---------|--------|
| `Profile.tsx` | remove photo | save success, upload error |
| `SettingsScreen.tsx` | sign out, coming soon | — |
| `SessionScreen.tsx` | logout flows | nested success/error |
| `CompanyList.tsx` | — | create success (Confirm today) |
| `ChangePassword.tsx` | — | success via Confirm |
| `AttendanceScreen.tsx` | punch confirms | errors |

Prefer **`StatusAlert`** for new success/error one-button feedback.

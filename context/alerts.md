# One Attendance — Alerts & confirms (`context/alerts.md`)

Attach when implementing **confirmation dialogs**, **error popups**, or **“coming soon”** messages.

---

## Component

**`src/components/modals/ConfirmAlert.tsx`**

- Renders a **modal card** (title, message, button row/column).
- Props: `visible`, `onDismiss`, `title`, `message`, `buttons[]`, variants (`primary`, `secondary`, `danger`, …), `dismissOnBackdropPress`, `dismissOnHardwareBack`, `buttonLayout`, etc.
- Full prop types: **`ConfirmAlertProps`**, **`ConfirmAlertButton`** in the same file.

---

## Hook: `useConfirmAlert`

```tsx
const { props: confirmProps, present, dismiss, visible } = useConfirmAlert();

// In JSX (typically at end of screen, sibling to main content):
<ConfirmAlert {...confirmProps} />
```

### `present(config)`

- **`ConfirmAlertPresentConfig`**: merges with defaults (`dismissOnBackdropPress: true`, etc.).
- Required: **`buttons`**: array of `{ text, variant?, onPress?, key?, ... }`.
- Optional: **`title`**, **`message`**, **`onAfterDismiss`** (runs after close).
- **`onPress`** on a button runs your logic; dialog usually closes when the button has default **`closeOnPress: true`**.

### Typical patterns

**Single OK alert**

```ts
present({
  title: t('settings.alerts.comingSoonTitle'),
  message: t('settings.alerts.comingSoonMessage'),
  buttons: [{ text: t('settings.alerts.ok'), variant: 'primary' }],
});
```

**Cancel + confirm (async on confirm)**

```ts
present({
  title: '…',
  message: '…',
  buttons: [
    { key: 'cancel', text: t('settings.alerts.cancel'), variant: 'secondary' },
    {
      key: 'ok',
      text: t('settings.alerts.ok'),
      variant: 'primary',
      onPress: () => { void doWork(); },
    },
  ],
});
```

Nested **`present()`** after an async action (e.g. success/error) is used in **`SessionScreen`** for logout flows.

---

## i18n keys

- Many screens reuse **`settings.alerts.*`** for generic OK / Cancel / coming soon copy (`en.ts` / `hi.ts` under `settings.alerts`).
- Prefer **namespaced keys** per feature when strings are specific (`settings.sessions.*`).

---

## When not to use `ConfirmAlert`

- **Blocking OS permission** dialogs — use system APIs.
- **Toast/snackbar**-only feedback — not implemented as a shared primitive here; would be a separate choice.

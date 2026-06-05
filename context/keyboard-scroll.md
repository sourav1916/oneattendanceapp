# Keyboard-safe scroll (React Native)

Use this pattern so inputs stay visible when the keyboard opens. Users can scroll the full form; the screen bottom sits above the keyboard instead of being covered.

**Reference screens**

| Pattern                              | Screen          | Path                                  |
| ------------------------------------ | --------------- | ------------------------------------- |
| Full-screen scroll (no fixed header) | Login           | `src/screens/auth/LoginScreen.tsx`    |
| Fixed header + scroll body           | Change password | `src/screens/auth/ChangePassword.tsx` |
| Fixed header + scroll body (simpler) | Edit profile    | `src/screens/profile/EditProfile.tsx` |

**Bottom-sheet modals** (fixed header + scroll body + footer) use a **different** layout recipe — see [**modals.md** → Keyboard-aware bottom sheets](./modals.md#keyboard-aware-bottom-sheets-fixed-header--scroll-body--footer). Reference: `LeaveConfigFormModal.tsx`, `AssignLeaveBalanceModal.tsx`, `UpdateLeaveBalanceModal.tsx`.

**Android requirement:** `android/app/src/main/AndroidManifest.xml` must use `android:windowSoftInputMode="adjustResize"` on the main activity (already set in this project).

---

## Shared rules

1. **`useSafeAreaInsets()`** from `react-native-safe-area-context` — use for bottom padding and (when needed) keyboard offset.
2. **`SafeAreaView` with `edges={['top']}`** — do not apply bottom safe area on the outer wrapper; put bottom inset in scroll `paddingBottom` instead so keyboard math stays correct.
3. **`ScrollView`** (not only `KeyboardAvoidingView` without scroll) — long forms must scroll vertically.
4. **`keyboardShouldPersistTaps="handled"`** — taps on buttons/links work while the keyboard is open.
5. **`showsVerticalScrollIndicator={false}`** — optional; matches auth/settings screens.
6. **Bottom padding:** `paddingBottom: Math.max(16, insets.bottom)` on `contentContainerStyle` (use `36` if the last control needs more breathing room).
7. **Avoid** wrapping the whole screen in `KeyboardAvoidingView` _and_ `automaticallyAdjustKeyboardInsets` on iOS without testing — that can double-shift. Pick the pattern below.

---

## Pattern A — Full-screen scroll (no fixed header)

Use when the whole screen scrolls (e.g. login, register). No stack header outside the scroll.

```tsx
import { Platform, ScrollView } from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

function MyScreen() {
  const insets = useSafeAreaInsets();

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top']}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: Math.max(16, insets.bottom) },
        ]}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        showsVerticalScrollIndicator={false}
      >
        {/* form fields */}
      </ScrollView>
    </SafeAreaView>
  );
}
```

**Do not** set `style={{ flex: 1 }}` on `ScrollView` unless the parent is a flex container that needs it; Login relies on content + insets only.

---

## Pattern B — Fixed header + scrollable body (recommended for settings stack)

Use when a **back bar / title stays fixed** and only the content below scrolls (e.g. change password, edit profile).

```tsx
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

const STACK_HEADER_HEIGHT = 52; // match stackHeader minHeight / maxHeight

function MyScreen() {
  const insets = useSafeAreaInsets();
  const keyboardVerticalOffset = insets.top + STACK_HEADER_HEIGHT;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.flex}>
        <View style={styles.stackHeader}>{/* HeaderBackButton + title */}</View>

        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={keyboardVerticalOffset}
        >
          <ScrollView
            style={styles.flex}
            contentContainerStyle={[
              styles.scroll,
              { paddingBottom: Math.max(16, insets.bottom) },
            ]}
            keyboardShouldPersistTaps="handled"
            automaticallyAdjustKeyboardInsets={Platform.OS === 'android'}
            showsVerticalScrollIndicator={false}
          >
            {/* form fields */}
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </SafeAreaView>
  );
}
```

| Piece                               | Role                                                                                      |
| ----------------------------------- | ----------------------------------------------------------------------------------------- |
| `KeyboardAvoidingView`              | Shrinks / pads the area **below** the fixed header when the keyboard opens.               |
| `keyboardVerticalOffset`            | `insets.top + header height` so iOS accounts for status bar + header.                     |
| `behavior`                          | `'padding'` on iOS, `'height'` on Android.                                                |
| `automaticallyAdjustKeyboardInsets` | Enable on **Android only** inside `ScrollView` to help content scroll above the keyboard. |
| `ScrollView` `style={{ flex: 1 }}`  | Fills space under the header inside the avoiding view.                                    |

If the keyboard still covers fields on a device, increase `STACK_HEADER_HEIGHT` to match your real header (including borders).

---

## Pattern B (lighter) — Fixed header, ScrollView only

`EditProfile` uses only `automaticallyAdjustKeyboardInsets` without `KeyboardAvoidingView`. Works for shorter forms; for **many fields** (e.g. change password), prefer **Pattern B** above.

```tsx
<SafeAreaView edges={['top', 'left', 'right']}>
  <View style={{ flex: 1 }}>
    <View style={styles.stackHeader}>{/* ... */}</View>
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={[
        styles.body,
        { paddingBottom: Math.max(36, insets.bottom) },
      ]}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
      showsVerticalScrollIndicator={false}
    >
      {/* fields */}
    </ScrollView>
  </View>
</SafeAreaView>
```

---

## Checklist for a new screen

- [ ] Import `useSafeAreaInsets` and use `edges={['top']}` on outer `SafeAreaView` (or document why you need left/right).
- [ ] Wrap long forms in `ScrollView` with `keyboardShouldPersistTaps="handled"`.
- [ ] Set `contentContainerStyle` `paddingBottom` with `Math.max(16, insets.bottom)` (or `36`).
- [ ] If there is a **fixed header outside** the scroll → use **Pattern B** (`KeyboardAvoidingView` + offset).
- [ ] If the **entire screen scrolls** → use **Pattern A** (`automaticallyAdjustKeyboardInsets` only).
- [ ] Do not use `KeyboardAvoidingView` as the only wrapper without `ScrollView` on long forms.
- [ ] Test on Android: focus last field, confirm submit button is reachable by scrolling.

---

## Common mistakes

| Mistake                                                          | Why it fails                                                                   |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `SafeAreaView` with `edges={['bottom']}` + keyboard insets       | Double bottom spacing or wrong keyboard overlap.                               |
| Entire row is `Pressable` with inputs below fold                 | Keyboard covers fields; user cannot scroll to them.                            |
| `keyboardDismissMode="on-drag"` only, no inset adjustment        | Drag dismisses keyboard but does not keep focused field visible.               |
| Fixed header + `ScrollView` with insets only (long form)         | `automaticallyAdjustKeyboardInsets` may not account for header; use Pattern B. |
| `flex: 1` on parent but no `flex: 1` on scroll area under header | Scroll view does not fill remaining height; keyboard overlap.                  |

---

## Modals with inputs

Bottom sheets / modals use a different layout (fixed sheet height when keyboard open, `Keyboard` listeners). See `ChangePhoneModal.tsx` / `ChangeEmailModal.tsx` and `context/modals.md` — do not copy Pattern A/B verbatim into nested `Modal` content.

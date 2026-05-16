# One Attendance — Navigation (`context/navigation.md`)

Attach when changing **routes**, **headers**, **tabs**, or **deep linking**.

---

## Type definitions

**`src/navigation/types.ts`**

- **`AuthStackParamList`**: `Login`, `Register`, `ForgotPassword`, `VerifyEmailOtp` (+ params where needed).
- **`SettingsStackParamList`**: `SettingsHome`, `Sessions`.
- **`MainTabParamList`**: `Home`, `Attendance`, `Settings`.

Use these with `NativeStackScreenProps<..., 'RouteName'>` etc.

---

## Navigators

### `AuthNavigator` (`src/navigation/AuthNavigator.tsx`)

- **Native stack**, `headerShown: false`.
- **Initial**: `Login`.

### `MainNavigator` (`src/navigation/MainNavigator.tsx`)

- **`createBottomTabNavigator`**
- **Global `screenOptions`**: `headerShown: true`, **`header: () => <MainTopBar />`** (custom top bar for all tabs).
- **Tabs**: `Home` → `HomeScreen.js`; `Attendance` → `AttendanceScreen.tsx`; `Settings` → **`SettingsNavigator`** (nested stack).
- **Tab bar**: custom pressable (no ripple), lifted icon/label animation, **MaterialCommunityIcons** for tab icons.

### `SettingsNavigator` (`src/navigation/SettingsNavigator.tsx`)

- **Native stack**, default **`headerShown: false`** on the stack (individual screens opt in).
- **`SettingsHome`**: main settings menu.
- **`Sessions`**: **`SessionScreen`** — uses **in-screen** compact header + `goBack()` (native stack header disabled to avoid double safe-area height under `MainTopBar`).

---

## Common navigation calls

- From a screen inside tabs: **`navigation.navigate('Attendance')`**, **`navigation.navigate('Settings')`**.
- From Settings stack to Sessions: **`navigation.navigate('Sessions')`** (as used in `SettingsScreen`).
- Back from Sessions: **`navigation.goBack()`** on custom header.

---

## Gates

- **`CompanySelectionGate`** wraps **`MainTabNavigator`** in `MainNavigator.tsx` — blocks main UI until company selection rules are satisfied.

---

## Path alias

Imports use **`@src/...`** (configured in `babel.config.js`).

# One Attendance — Navigation (`context/navigation.md`)

Attach when changing **routes**, **headers**, **tabs**, or **deep linking**.

---

## Type definitions

**`src/navigation/types.ts`**

- **`AuthStackParamList`**: `Login`, `Register`, `ForgotPassword`, `VerifyEmailOtp` (+ params where needed).
- **`SettingsStackParamList`**: `SettingsHome`, `Profile`, **`EditProfile`**, `Sessions`, `ChangePassword`, **`MyCalendar`**.
- **`HomeStackParamList`**: `HomeMain`, `LeaveRequest`, **`LeaveManagement`**, **`LeaveRequests`**, **`LeaveBalance`**, **`LeaveConfig`**, **`MyCalendar`**, **`CompanyList`**, **`AttendanceManagement`**, **`EmployeeManagement`**, **`EmployeeList`**, `FaceEnroll`, `FaceAttendance`, `CompanyLedger`, `Ledger`, `OnboardingRequest`, `CreateEmployee`, invite/permission routes, etc.
- **`MainTabParamList`**: `Home`, `Attendance`, **`AttendanceManagement`** (owners), **`FaceAttendance`** (conditional), `Settings`.
- **`FaceAttendanceFlowParamList`**: `FaceAttendance`, `FaceEnroll`.

Use these with `NativeStackScreenProps<..., 'RouteName'>` etc.

---

## Navigators

### `AuthNavigator` (`src/navigation/AuthNavigator.tsx`)

- **Native stack**, `headerShown: false`.
- **Initial**: `Login`.

### `MainNavigator` (`src/navigation/MainNavigator.tsx`)

- **`createBottomTabNavigator`**
- **Global `screenOptions`**: `headerShown: true`, **`header: () => <MainTopBar />`** (custom top bar for all tabs).
- **Tabs**: `Home` → **`HomeNavigator`** (nested stack); `Attendance` → self punch (`AttendanceScreen`); **`AttendanceManagement`** → company list (shown when `selectedCompany.relation === 'owned'` instead of `Attendance`); optional **`FaceAttendance`** tab (`FaceAttendanceNavigator`, gated by `canShowFaceAttendanceTab` in `src/utils/faceAttendanceAccess.ts`); `Settings` → **`SettingsNavigator`**.
- **Tab bar**: custom pressable (no ripple), lifted icon/label animation, **MaterialCommunityIcons** for tab icons.
- **Home** / **Settings** tabs use **`Tab.Screen` `listeners.focus`** → **`navigation.navigate(tab, { screen: root })`** when nested `state.index &gt; 0` (reset when **returning** to the tab). Do **not** use **blur** — `navigate('Settings', …)` on blur re-selects Settings and breaks switching to Attendance.

### `HomeNavigator` (`src/navigation/HomeNavigator.tsx`)

- **Native stack**, **`headerShown: false`**.
- **`HomeMain`**: dashboard grid (`HomeScreen.tsx`).
- **`LeaveRequest`**, **`LeaveManagement`**, **`LeaveRequests`**, **`LeaveBalance`**, **`LeaveConfig`**, **`CompanyList`**, **`EmployeeManagement`**, **`EmployeeList`**, **`AttendanceManagement`**, **`OnboardingRequest`**, **`Ledger`**, etc.: sub-screens from home tiles or cross-links.
- **`MyCalendar`**: **`MyCalendarScreen`** from `src/screens/report/Calendar.tsx` (same component as Settings route).

### `SettingsNavigator` (`src/navigation/SettingsNavigator.tsx`)

- **Native stack**, default **`headerShown: false`** on the stack (individual screens opt in).
- **`SettingsHome`**: main settings menu.
- **`Profile`**, **`EditProfile`**, **`ChangePassword`**: account screens — profile UX/API/cache: [**profile.md**](./profile.md).
- **`Sessions`**: **`SessionScreen`** — uses **in-screen** compact header + `goBack()` (native stack header disabled to avoid double safe-area height under `MainTopBar`).
- **`MyCalendar`**: attendance calendar (Settings → Work → Calendar row).

---

## Common navigation calls

- From a screen inside tabs: **`navigation.navigate('Attendance')`**, **`navigation.navigate('Settings')`**.
- From Settings stack to Sessions: **`navigation.navigate('Sessions')`** (as used in `SettingsScreen`).
- From Home or Settings to calendar: **`navigation.navigate('MyCalendar')`**.
- Back from sub-screens (Sessions, My Calendar, etc.): **`navigation.goBack()`** on custom header.

---

## Gates

- **`CompanySelectionGate`** wraps **`MainTabNavigator`** in `MainNavigator.tsx` — blocks main UI until company selection rules are satisfied.

---

## Path alias

Imports use **`@src/...`** (configured in `babel.config.js`).

# One Attendance — Truecaller login (`context/truecaller.md`)

Attach when working on **Truecaller OAuth** on the login screen or Android signing for Truecaller.

---

## Package

- **`@ajitpatel28/react-native-truecaller`** (Android SDK 3.2.1)
- Hook: **`src/hooks/useLoginTruecaller.ts`**
- Screen: **`src/screens/auth/LoginScreen.tsx`** — auto-opens consent on mount when configured; manual **Continue with Truecaller** button

---

## Configuration (required before it works)

1. Create an app at [Truecaller Developer](https://developer.truecaller.com).
2. Register **package** `in.onesaas.attendance` and **SHA-1** from [**SHA.md**](./SHA.md).
3. Set the **same client ID** in both places:
   - `src/utils/config.ts` → `TRUECALLER_ANDROID_CLIENT_ID`
   - `android/gradle.properties` → `TRUECALLER_ANDROID_CLIENT_ID`
4. Rebuild the Android app (`npx react-native run-android`).

iOS keys (`TRUECALLER_IOS_APP_KEY`, `TRUECALLER_IOS_APP_LINK`) are optional; the wrapper’s iOS path is less mature.

---

## Native Android

- `AndroidManifest.xml`: `com.truecaller.android.sdk.ClientId` via `${truecallerClientId}`; `<package android:name="com.truecaller" />` in `<queries>`
- `android/app/build.gradle`: `manifestPlaceholders` from `gradle.properties`

---

## Behaviour

| Event | App behaviour |
|--------|----------------|
| Login screen opens (Android, client ID set) | Initialize SDK → if Truecaller app usable → show consent sheet |
| User approves | Profile email prefills email field; phone logged (wire API when backend ready) |
| Not configured | No auto-prompt; no Truecaller button |
| Device without Truecaller | Silent skip on auto-open; manual button shows error |

---

## Backend (TODO)

Wire `onProfile` / `androidSuccessHandler` to your API when `/auth/login/truecaller` (or similar) exists. OAuth payload includes `authorizationCode` + `codeVerifier` for server-side token exchange.

---

*Last verified: 2026-05-17*

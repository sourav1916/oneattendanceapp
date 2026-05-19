# Android signing — SHA fingerprints

Reference for **Firebase**, **Google Sign-In**, **Google Maps**, and other Google APIs that require the app’s certificate fingerprint.

Config: `android/app/build.gradle` → `signingConfigs.debug` uses `android/app/debug.keystore`.

---

## App identity (register in Google / Firebase)

| Field | Value |
|--------|--------|
| **Package name** | `in.onesaas.attendance` |
| **Namespace** | `in.onesaas.attendance` |

---

## Primary keystore (use this)

This project signs **debug** and **release** builds with the same file today (`signingConfig signingConfigs.debug` on release).

| Field | Value |
|--------|--------|
| **Keystore path** | `android/app/debug.keystore` |
| **Alias** | `androiddebugkey` |
| **Store password** | `android` |
| **Key password** | `android` |
| **SHA-1** | `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25` |
| **SHA-256** | `FA:C6:17:45:DC:09:03:78:6F:B9:ED:E6:2A:96:2B:39:9F:73:48:F0:BB:6F:89:9B:83:32:66:75:91:03:3B:9C` |

Copy **SHA-1** into Firebase Console → Project settings → Your apps → Android → Add fingerprint.

---

## Secondary keystore (not used by this app’s Gradle config)

Default Android SDK debug store on this machine. **Do not** add unless you change signing to use it.

| Field | Value |
|--------|--------|
| **Keystore path** | `%USERPROFILE%\.android\debug.keystore` |
| **Alias** | `AndroidDebugKey` |
| **Store / key password** | `android` |
| **SHA-1** | `0D:4A:A7:8F:86:B1:9E:2F:06:FF:8A:C5:76:21:E0:05:66:61:6C:12` |
| **SHA-256** | `B1:C4:29:78:D2:1A:FB:3F:27:5C:4E:C6:11:BF:1C:10:9F:8C:3B:21:0C:6B:3F:2E:E1:49:CD:90:4E:D5:41:26` |

---

## Regenerate fingerprints

From repo root (Windows PowerShell):

```powershell
cd android
.\gradlew signingReport
```

Look for variant **debug** / **release** under module `:app` — store path should be `...\android\app\debug.keystore`.

Or with `keytool`:

```powershell
keytool -list -v -keystore "android\app\debug.keystore" -alias androiddebugkey -storepass android -keypass android
```

---

## Production / Play Store

Before publishing:

1. Generate a **release keystore** (keep passwords and file backed up securely).
2. Point `signingConfigs.release` in `android/app/build.gradle` to that keystore.
3. Run `.\gradlew signingReport` again and add the **release SHA-1** (and SHA-256) to Firebase / Google Cloud.

Until then, Play-internal testing builds signed with `debug.keystore` use the **Primary keystore** SHA-1 above.

---

## Last verified

2026-05-17 — via `gradlew signingReport` and `keytool -list -v`.

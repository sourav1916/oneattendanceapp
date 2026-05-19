# Google Sign-In (`context/google-signin.md`)

Attach when fixing **DEVELOPER_ERROR** or wiring Google login.

---

## Two different files (do not confuse)

| File | What it is |
|------|------------|
| `client_secret_*.json` (Downloads) | OAuth client metadata from Google Cloud. Your Android client ID lives under `"installed"`. **Do not commit** if it contains `client_secret`. |
| `google-services.json` | Firebase Android config (optional). Place at `android/app/google-services.json` and rebuild. Template: `android/app/google-services.json.example`. |

---

## GCP project (from your OAuth JSON)

| Field | Value |
|--------|--------|
| Project ID | `project-28ae857c-dd8c-48c3-bc6` |
| Project number | `1099166791217` |
| Android client ID | `1099166791217-gv208acpiqat45qg263n6jhuifu7vvji.apps.googleusercontent.com` → `GOOGLE_ANDROID_CLIENT_ID` in `config.ts` |

---

## Two OAuth clients required (same GCP project)

| Type | Config constant | Used for |
|------|-----------------|----------|
| **Android** | `GOOGLE_ANDROID_CLIENT_ID` | Registered with package `in.onesaas.attendance` + SHA-1 `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25` — not passed in SDK `configure()` |
| **Web application** | `GOOGLE_WEB_CLIENT_ID` | Passed as `webClientId` in `@react-native-google-signin` → ID token for `/auth/continue/google` |

Your downloaded JSON is the **Android** (installed) client. You still need to **create a Web application** OAuth client:

1. [Google Cloud Credentials](https://console.cloud.google.com/apis/credentials?project=project-28ae857c-dd8c-48c3-bc6)
2. **Create credentials → OAuth client ID → Web application**
3. Copy the new client ID into `GOOGLE_WEB_CLIENT_ID` in `src/utils/config.ts`
4. Rebuild: `npx react-native run-android`

---

## Code paths

- `src/utils/googleSignIn.ts` — `webClientId: GOOGLE_WEB_CLIENT_ID`
- `src/api/continueWithGoogle.ts` — `POST /auth/continue/google`

---

*Last verified: 2026-05-17*

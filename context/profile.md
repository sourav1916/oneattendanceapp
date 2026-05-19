# One Attendance — Profile (`context/profile.md`)

Attach when working on **view/edit profile**, **avatar upload**, **profile-role cache sync**, or related settings UX.

---

## Screen & navigation

| Item | Location |
|------|----------|
| View screen | `src/screens/profile/Profile.tsx` |
| Edit screen | `src/screens/profile/EditProfile.tsx` — `EditProfileScreen` |
| Display helpers | `src/utils/profileDisplay.ts` — `readProfileData`, `DisplayProfile` |
| Form helpers | `src/utils/profileEditForm.ts` |
| Route | `SettingsStackParamList.Profile` — **Settings → Profile** |
| Navigator | `src/navigation/SettingsNavigator.tsx` (`headerShown: false`; in-screen back header) |

Entry from **`MainTopBar`** avatar also lands on the Settings tab (user opens Profile from settings menu).

---

## Data sources (display)

Read order for hero + contact rows:

1. **`profileRole.data.user`** from last `GET /users/profile-role`
2. **`cachedUserProfile`** (summary persisted in AsyncStorage)
3. **Session** `name` / `email` from `AuthContext` (login storage)

Helper **`readProfileData(user)`** in `Profile.tsx` normalizes API field names (`profile_picture`, `profile_image`, `mobile`, `phone`, etc.).

While **`profileRoleLoading`** and no user/cache yet → **skeleton** on hero card.

On mount: **`refreshProfileRole()`** (non-silent) refetches profile-role.

---

## Edit flow (stack screen)

- **Edit profile** → `navigation.navigate('EditProfile')` from **`Profile.tsx`**.
- Route: **`SettingsStackParamList.EditProfile`** in **`SettingsNavigator.tsx`**.
- Back: header back or success alert **`onAfterDismiss`** → `goBack()`.
- Fields: name, phone (digits only), email **read-only**.
- Photo: pick from library → upload immediately; **Save** sends URL via update-profile.

### Photo upload (`uploadFileToOneSaas`)

| Outcome | UX |
|---------|-----|
| **Success** | Preview updates to uploaded URL; **no** status popup (silent). `pendingAvatarUploadedUrl` set; local file cleared. |
| **Failure** | Inline **`errorBanner`** in edit modal **and** **`presentError`** status alert (`settings.profile.uploadErrorTitle` + API message). Failed local pick kept so user can retry. |

Upload runs on pick; **Save** only submits the returned URL (or removal) in the PUT body.

### Save (`PUT /users/update-profile`)

| Step | What happens |
|------|----------------|
| Validate | `src/utils/profileEditForm.ts` — phone change rules, payload build, “no changes” |
| API | `updateProfile()` → `src/api/updateProfile.ts` |
| Session | `applySessionFromProfileUpdate(data)` — merges user into `profileRole`, `cachedUserProfile`, `profileRoleUser`, auth name/email storage |
| Background sync | `void refreshProfileRole({ silent: true })` — refetches profile-role **without** `profileRoleLoading`; persists full **`data.user`** via `saveProfileRoleUser` |
| UI | Close edit modal → **`presentSuccess`** status alert (profile updated) |

Save errors stay in the edit modal **banner** (no status alert unless you add one later).

### Remove photo

**`useConfirmAlert`** (not StatusAlert): cancel + danger **Remove** → sets `wantsRemovePhoto`; applied on Save with `profile_picture: null`.

---

## Alerts on this screen

| Case | Where | Component |
|------|--------|-----------|
| Remove photo confirm | `EditProfile.tsx` | `ConfirmAlert` |
| Photo upload failure | `EditProfile.tsx` | `StatusAlert` → `presentError` |
| Photo upload success | — | *(none)* |
| Profile save success | `EditProfile.tsx` | `StatusAlert` → `presentSuccess`, then `goBack` |

See [**alerts.md**](./alerts.md) for `StatusAlert` API and tones.

---

## Auth & cache (`AuthContext`)

Relevant APIs:

| Method | Use |
|--------|-----|
| `refreshProfileRole(options?)` | Refetch `GET /users/profile-role`. **`{ silent: true }`** skips loading flag and avoids blocking `CompanySelectionGate`. |
| `applySessionFromProfileUpdate(user)` | Immediate merge after PUT update-profile |
| `cachedUserProfile` | Lightweight summary for UI when API not ready |
| `profileRoleUser` | Full `data.user` object (memory + `@oneattendance/profileRoleUserV1`) |

Persistence: **`src/storage/userProfileCache.ts`**.

After profile save, **silent** refresh ensures other screens (e.g. **MainTopBar**) see updated name/avatar without waiting on a blocking loader.

---

## APIs

| Endpoint | Client |
|----------|--------|
| `GET /users/profile-role` | `fetchProfileRole.ts` |
| `PUT /users/update-profile` | `updateProfile.ts` — partial body: `name`, `phone`, `profile_picture` |
| File upload | `uploadFileToOneSaas` in `src/utils/FileUpload.ts` |

No `company` header on profile routes (user-scoped).

---

## i18n (`settings.profile.*`)

Key strings in `src/locales/en.ts`:

- `successTitle`, `successMessage`, `successButton`, `successDismissA11y`
- `uploadErrorTitle`, `uploadErrorDismissA11y`
- `removePhotoConfirmTitle` / `Message` / `Action`
- Form labels, errors under `settings.profile.errors.*`

(`uploadSuccessTitle` / `uploadSuccessMessage` remain in locale but are **not** shown after upload — success is silent.)

---

## Related docs

- [**alerts.md**](./alerts.md) — `ConfirmAlert`, `StatusAlert`
- [**modals.md**](./modals.md) — modal patterns, upload helper
- [**navigation.md**](./navigation.md) — Settings stack routes
- [**theme-api.md**](./theme-api.md) — `authHttpClient`, Bearer auth

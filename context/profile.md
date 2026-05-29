# One Attendance — Profile (`context/profile.md`)

Attach when working on **view/edit profile**, **avatar upload**, **profile-role cache sync**, or related settings UX.

---

## Screen & navigation

| Item | Location |
|------|----------|
| View screen | `src/screens/profile/Profile.tsx` |
| Edit screen | `src/screens/profile/EditProfile.tsx` — `EditProfileScreen` |
| Display helpers | `src/utils/profileDisplay.ts` — `readProfileData`, `DisplayProfile` |
| User display (top bar / home) | `src/utils/userDisplay.ts` — `profilePictureFromSources`, initials |
| Media URLs | `src/utils/resolveMediaUrl.ts` |
| Form helpers | `src/utils/profileEditForm.ts` — payload build, `partialUserFromUpdatePayload` |
| Routes | `SettingsStackParamList.Profile`, `EditProfile` |
| Navigator | `src/navigation/SettingsNavigator.tsx` |

Entry: **Settings** menu → Profile; **MainTopBar** avatar → Settings tab (user opens Profile from there).

---

## Data sources (display)

Read order for hero + contact rows (`Profile.tsx`):

1. **`profileRole.data.user`** or **`profileRoleUser`**
2. **`cachedUserProfile`** (AsyncStorage summary)
3. Session **`name`** / **`email`** from auth storage

**`readProfileData(user)`** in `profileDisplay.ts` normalizes field names (`profile_picture`, `profile_image`, `mobile`, `phone`, etc.).

Hero avatar uses **`resolveMediaUrl()`** for image `uri`.

Skeleton on hero while **`profileRoleLoading`** and no user/cache yet.

On mount: **`refreshProfileRole()`** (non-silent).

---

## Edit flow (`EditProfileScreen`)

- **Edit profile** → `navigation.navigate('EditProfile')` from Profile.
- Back: header back, or **`StatusAlert`** success **`onAfterDismiss`** → `goBack()`.
- Form resets on screen focus via **`useFocusEffect`**, except during image pick/upload (**`photoSessionActiveRef`** blocks reset when returning from the gallery).

### Photo upload

Same pipeline as **face enrollment** capture: **`uploadFileToOneSaas`** (`src/utils/FileUpload.ts`). Face flow also uses **`saveCameraPhotoForUpload`** for camera orientation — see [**face-enroll.md**](./face-enroll.md).

| Outcome | UX |
|---------|-----|
| **Success** | Preview shows uploaded URL via **`resolveMediaUrl`**; **no** popup |
| **Failure** | Inline banner + **`StatusAlert` `presentError`** |

**`photoSessionActiveRef`**: prevents `useFocusEffect` from clearing `pendingAvatarUploadedUrl` when the image library closes (common Android bug).

### Save (`PUT /users/update-profile`)

| Step | Behavior |
|------|----------|
| Validate | `profileEditForm.ts` |
| API | `updateProfile()` → returns **`{ message, user \| null }`** |
| API success body | Often **`{ success: true, message: "…" }`** only — **no `data`**; treat as success |
| Cache | `applySessionFromProfileUpdate(user ?? partialUserFromUpdatePayload(payload))` |
| Sync | **`await refreshProfileRole({ silent: true })`** |
| UI | **`presentSuccess`** with API **`message`** text, then **`goBack`** on dismiss |

Save errors: inline banner only (no status alert).

### Remove photo

**`ConfirmAlert`** in `EditProfile.tsx` — danger confirm; applied on Save with `profile_picture: null`.

---

## Alerts (`EditProfile.tsx`)

| Case | Component |
|------|-----------|
| Remove photo | `ConfirmAlert` |
| Upload failure | `StatusAlert` → `presentError` |
| Upload success | *(none)* |
| Save success | `StatusAlert` → `presentSuccess` (API `message`) |

See [**alerts.md**](./alerts.md).

---

## Auth & cache (`AuthContext`)

| Method | Use |
|--------|-----|
| `refreshProfileRole({ silent?: true })` | Refetch profile-role; silent skips `profileRoleLoading` |
| `applySessionFromProfileUpdate(Partial<UserProfile>)` | Merge into session, `profileRole`, cache |
| `cachedUserProfile` | Summary row for fast UI |
| `profileRoleUser` | Full `data.user` persisted |

**Silent refresh quirk (fixed):** when companies unchanged, `profileRole` state still **merges fresh `data.user`** so UI (e.g. MainTopBar) does not keep stale avatar while cache was updated.

Persistence: **`src/storage/userProfileCache.ts`**.

---

## APIs

| Endpoint | Client |
|----------|--------|
| `GET /users/profile-role` | `fetchProfileRole.ts` |
| `PUT /users/update-profile` | `updateProfile.ts` |
| Upload | `uploadFileToOneSaas` in `FileUpload.ts` |

No `company` header on profile routes.

---

## i18n

`settings.profile.*` — success, upload error, form labels, `errors.*`.  
`uploadSuccessTitle` / `uploadSuccessMessage` are unused (upload success is silent).

---

## Related docs

- [**alerts.md**](./alerts.md) — `StatusAlert`, `ConfirmAlert`
- [**modals.md**](./modals.md) — sheet patterns
- [**navigation.md**](./navigation.md) — Settings stack
- [**home.md**](./home.md) — top bar avatar uses same cache

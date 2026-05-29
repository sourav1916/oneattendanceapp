# One Attendance — Face enrollment (`context/face-enroll.md`)

Attach when working on **face enroll list/capture**, **face check**, upload + `/employees/face-enroll/*` APIs, or Vision Camera on company screens.

**Related:** [**company.md**](./company.md), [**profile.md**](./profile.md) (image upload), [**alerts.md**](./alerts.md), [**navigation.md**](./navigation.md), tab layout in [**Main.md**](./Main.md#12-tab-screens--bottom-navigation).

---

## Overview

Face enrollment is **server-side**: the app uploads a **JPEG URL** to OneSaaS upload, then calls attendance API with `{ employee_id, image }`. There is **no** client-side face descriptor / `face_data` / face-api.js / TensorFlow on device.

| Step | Where |
|------|--------|
| List employees + enroll status | `FaceEnrollList.tsx` |
| Capture + upload + API | `FaceEnrollCapture.tsx` |
| Live “face ready” hint | ML Kit via `react-native-vision-camera-face-detector` |
| Oriented JPEG for upload | `saveCameraPhotoForUpload.ts` (Vision Camera `Photo.toImageAsync` → nitro-image save) |

**Entry:** Home → Employee Management → **Face enrollment** → list → **Set up face** / **Check face**.

---

## Navigation

| Route | Screen | Params |
|-------|--------|--------|
| `FaceEnrollList` | `FaceEnrollList.tsx` | — |
| `FaceEnrollCapture` | `FaceEnrollCapture.tsx` | `employeeId`, `employeeName`, `mode?: 'enroll' \| 'check'` (default `enroll`) |

Stack: **`HomeNavigator`** (`src/navigation/HomeNavigator.tsx`), types in **`HomeStackParamList`**.

---

## APIs (`src/api/`)

All use **`authHttpClient`**, header **`company: String(companyId)`**, and **120s timeout** (face processing can exceed default 30s).

| Function | Method | Path | Body |
|----------|--------|------|------|
| `fetchFaceEnrollList` | GET | `/employees/face-enroll/list` | Query: `page`, `limit`, `search` |
| `setEmployeeFaceEnroll` | POST | `/employees/face-enroll/set` | `{ employee_id, image: string }` |
| `checkEmployeeFaceEnroll` | POST | `/employees/face-enroll/check` | `{ employee_id, image: string }` |
| `deleteEmployeeFaceEnroll` | PUT | `/employees/face-enroll/delete` | `{ employee_id }` |

Types: **`src/types/faceEnrollList.ts`**, **`faceEnrollSet.ts`**, **`faceEnrollCheck.ts`**.

### Check response (current backend)

Success example:

```json
{
  "success": true,
  "message": "Face matched",
  "data": {
    "employee_id": 59,
    "employee_name": "...",
    "company_id": 8,
    "similarity": 0.9356,
    "threshold": null
  }
}
```

No match: same shape with `message` like “not matched” and lower `similarity`.

**Do not** treat missing `data.enrolled` as “not enrolled”. Parsing lives in **`src/utils/parseFaceEnrollCheckResult.ts`** (message keywords, `similarity` vs `threshold`, legacy `is_match` / `enrolled` if present).

### Set response

```json
{
  "success": true,
  "message": "Face enrolled successfully",
  "data": { "employee_id": 21, "face_enrolled": true }
}
```

Require `data.face_enrolled === true` before success modal.

---

## Image upload (same as profile)

1. `photoOutput.capturePhoto()` — **no `setState` before capture** (avoids Vision Camera “Camera is closed”).
2. `saveCameraPhotoForUpload(photo)` — bakes orientation into pixels (do **not** use `photo.saveToTemporaryFileAsync()` alone for API upload).
3. `uploadFileToOneSaas` — `src/utils/FileUpload.ts`, `https://upload.onesaas.in/api/upload`.
4. POST enroll/check with returned `url`.

Hook **`useFaceEnrollList`** — `src/hooks/useFaceEnrollList.ts` (paginated list).

---

## `FaceEnrollList.tsx` UX rules

- Row is **not** tappable for profile (no `EmployeeProfile` navigation).
- **No** total/page stat cards in header.
- Actions: **Set up face** (`!face_enrolled`), **Check face** + **Delete** (`face_enrolled`).
- List uses **`TAB_SCREEN_SAFE_AREA_EDGES`** — see tab layout below.

---

## `FaceEnrollCapture.tsx` UX rules

- **Capture enabled only when `faceReady`** (ML Kit: single face, min size ratio `MIN_FACE_RATIO = 0.08`).
- Overlays: “Uploading photo…”, then “Verifying face…” / “Enrolling face…” during API.
- Results via **`StatusAlert`**: match / no match / enroll success / errors.
- **`onAfterDismiss: () => navigation.goBack()`** on success match/enroll — do **not** `goBack()` immediately after `presentSuccess` (unmounts modal).
- Errors: always **`readApiError(err)`** (not raw `err.message`) so 4xx bodies show `message`.
- Camera **`isActive`** must stay true during capture/upload; stabilize `useFaceDetectorOutput` callbacks with refs so re-renders do not rebind Camera outputs mid-capture.

---

## Removed / do not reintroduce

| Removed | Reason |
|---------|--------|
| `@vladmandic/face-api`, `@tensorflow/tfjs*`, `jpeg-js` | Server processes faces from image URL |
| `src/utils/faceDescriptor.ts`, `setupFaceApiEnv.ts` | Same |
| Metro alias for `@vladmandic/face-api` | N/A |
| Client `face_data: number[128]` payloads | API uses `image` URL |

**Keep:** `react-native-vision-camera`, `react-native-vision-camera-face-detector`, `react-native-nitro-image` (orientation only).

---

## Tab screens & bottom navigation

Screens under **Home stack** (tab bar visible) must match **`SettingsScreen`**:

```ts
import {
  TAB_SCREEN_SAFE_AREA_EDGES,
  TAB_SCREEN_SCROLL_PADDING_BOTTOM,
} from '@src/constants/tabScreenLayout';

<SafeAreaView edges={TAB_SCREEN_SAFE_AREA_EDGES}>
  <ScrollView contentContainerStyle={{ paddingBottom: TAB_SCREEN_SCROLL_PADDING_BOTTOM }} />
</SafeAreaView>
```

**Why:** `MainNavigator` sets `safeAreaInsets={{ bottom: 0 }}` and applies `insets.bottom` on **`tabBarStyle` only**. Using `edges` including `'bottom'` **doubles** bottom padding.

**Reference:** `src/screens/settings/SettingsScreen.tsx`, `src/navigation/MainNavigator.tsx` comment on tab bar.

Company screens updated to this pattern: see [**company.md**](./company.md#tab-layout-home-stack-screens).

Full-screen **modals** (e.g. `OnboardEmployeeModal`) may still use `bottom` edge when covering the whole screen.

---

## File map

```
src/
├── api/
│   ├── fetchFaceEnrollList.ts
│   ├── setEmployeeFaceEnroll.ts
│   ├── checkEmployeeFaceEnroll.ts
│   └── deleteEmployeeFaceEnroll.ts
├── constants/
│   └── tabScreenLayout.ts
├── hooks/
│   └── useFaceEnrollList.ts
├── screens/company/
│   ├── FaceEnrollList.tsx
│   └── FaceEnrollCapture.tsx
├── utils/
│   ├── parseFaceEnrollCheckResult.ts
│   ├── saveCameraPhotoForUpload.ts
│   └── FileUpload.ts
└── types/
    ├── faceEnrollList.ts
    ├── faceEnrollSet.ts
    └── faceEnrollCheck.ts
```

---

## i18n

Keys under **`home.faceEnrollList.*`** and **`home.faceEnrollCapture.*`** in `src/locales/en.ts`.

---

*Last updated: image-URL enroll/check flow, client ML packages removed, tab safe-area alignment with Settings.*

import type { UpdateProfileRequestBody, UserProfile } from '@src/api/updateProfile';

export type ProfileEditSnapshot = {
  name: string;
  email: string;
  phoneDigits: string;
  profilePictureUrl: string;
};

export function onlyDigits(s: string): string {
  return s.replace(/\D/g, '');
}

export type PictureSubmitState =
  | { kind: 'unchanged' }
  | { kind: 'removed' }
  | { kind: 'setUrl'; url: string };

/**
 * Builds the PUT body with only changed fields. Returns `null` if nothing would be sent
 * (caller should block submit).
 */
export function buildChangedProfileUpdatePayload(
  initial: ProfileEditSnapshot,
  draft: { name: string; phoneRaw: string },
  picture: PictureSubmitState,
): UpdateProfileRequestBody | null {
  const out: UpdateProfileRequestBody = {};
  const nameT = draft.name.trim();

  if (nameT !== initial.name.trim()) {
    out.name = nameT;
  }

  const phoneD = onlyDigits(draft.phoneRaw);
  const initPhone = initial.phoneDigits;
  if (phoneD !== initPhone) {
    if (phoneD.length === 0) {
      out.phone = '';
    } else if (phoneD.length >= 10 && phoneD.length <= 15) {
      out.phone = phoneD;
    }
  }

  if (picture.kind === 'removed') {
    if (initial.profilePictureUrl.trim().length > 0) {
      out.profile_picture = null;
    }
  } else if (picture.kind === 'setUrl') {
    const next = picture.url.trim();
    if (next !== initial.profilePictureUrl.trim()) {
      out.profile_picture = next;
    }
  }

  if (Object.keys(out).length === 0) {
    return null;
  }
  return out;
}

/** Blocks save when the phone field was edited but is not empty and not a complete number. */
export function validateProfilePhoneChange(
  initial: ProfileEditSnapshot,
  draft: { phoneRaw: string },
): string | null {
  const phoneD = onlyDigits(draft.phoneRaw);
  if (phoneD === initial.phoneDigits) {
    return null;
  }
  if (phoneD.length > 0 && (phoneD.length < 10 || phoneD.length > 15)) {
    return 'Phone must be 10–15 digits.';
  }
  return null;
}

/** Client-side checks before calling the API (after building the partial body). */
export function validateProfileUpdatePayload(
  draft: { name: string; phoneRaw: string },
  payload: UpdateProfileRequestBody | null,
): string | null {
  if (payload == null) {
    return null;
  }
  if (payload.name !== undefined && !draft.name.trim()) {
    return 'Name cannot be empty.';
  }
  if (payload.phone !== undefined && payload.phone !== '') {
    const d = onlyDigits(draft.phoneRaw);
    if (!/^\d{10,15}$/.test(d)) {
      return 'Phone must be 10–15 digits.';
    }
  }
  return null;
}

/** Maps PUT body fields into a partial user row when the API returns only `{ success, message }`. */
export function partialUserFromUpdatePayload(
  payload: UpdateProfileRequestBody,
): Partial<UserProfile> {
  const patch: Partial<UserProfile> = {};
  if (payload.name !== undefined) {
    patch.name = payload.name;
  }
  if (payload.phone !== undefined) {
    patch.phone = payload.phone;
  }
  if (payload.profile_picture !== undefined) {
    patch.profile_picture = payload.profile_picture;
  }
  return patch;
}

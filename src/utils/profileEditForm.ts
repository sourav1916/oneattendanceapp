import type { UpdateProfileRequestBody, UserProfile } from '@src/api/updateProfile';

export type ProfileEditSnapshot = {
  name: string;
  email: string;
  phoneDigits: string;
  profilePictureUrl: string;
  profession: string;
  whatsappDigits: string;
};

export function onlyDigits(s: string): string {
  return s.replace(/\D/g, '');
}

export type PictureSubmitState =
  | { kind: 'unchanged' }
  | { kind: 'removed' }
  | { kind: 'setUrl'; url: string };

/**
 * Builds the PUT body for changed fields. Always includes `name` (required by API).
 * Returns `null` if nothing changed besides a redundant name-only payload.
 */
export function buildChangedProfileUpdatePayload(
  initial: ProfileEditSnapshot,
  draft: { name: string; profession: string; whatsappRaw: string },
  picture: PictureSubmitState,
): UpdateProfileRequestBody | null {
  const nameT = draft.name.trim();
  const professionT = draft.profession.trim();
  const whatsappD = onlyDigits(draft.whatsappRaw);

  let pictureChanged = false;
  let nextProfilePicture: string | null | undefined;

  if (picture.kind === 'removed') {
    if (initial.profilePictureUrl.trim().length > 0) {
      pictureChanged = true;
      nextProfilePicture = null;
    }
  } else if (picture.kind === 'setUrl') {
    const next = picture.url.trim();
    if (next !== initial.profilePictureUrl.trim()) {
      pictureChanged = true;
      nextProfilePicture = next;
    }
  }

  const nameChanged = nameT !== initial.name.trim();
  const professionChanged = professionT !== initial.profession.trim();
  const whatsappChanged = whatsappD !== initial.whatsappDigits;

  if (!nameChanged && !professionChanged && !whatsappChanged && !pictureChanged) {
    return null;
  }

  const out: UpdateProfileRequestBody = { name: nameT };

  if (professionChanged) {
    out.profession = professionT;
  }
  if (whatsappChanged) {
    out.whatsapp = whatsappD;
  }
  if (pictureChanged && nextProfilePicture !== undefined) {
    out.profile_picture = nextProfilePicture;
  }

  return out;
}

/** Client-side checks before calling the API (after building the body). */
export function validateProfileUpdatePayload(
  draft: { name: string; whatsappRaw: string },
  payload: UpdateProfileRequestBody | null,
): string | null {
  if (payload == null) {
    return null;
  }
  if (!draft.name.trim()) {
    return 'Name cannot be empty.';
  }
  const whatsappD = onlyDigits(draft.whatsappRaw);
  if (payload.whatsapp !== undefined && whatsappD.length > 0) {
    if (whatsappD.length < 10 || whatsappD.length > 15) {
      return 'WhatsApp number must be 10–15 digits.';
    }
  }
  return null;
}

/** Maps PUT body fields into a partial user row when the API returns only `{ success, message }`. */
export function partialUserFromUpdatePayload(
  payload: UpdateProfileRequestBody,
): Partial<UserProfile> {
  const patch: Partial<UserProfile> = { name: payload.name };
  if (payload.profession !== undefined) {
    patch.profession = payload.profession;
  }
  if (payload.whatsapp !== undefined) {
    patch.whatsapp = payload.whatsapp;
  }
  if (payload.profile_picture !== undefined) {
    patch.profile_picture = payload.profile_picture;
  }
  return patch;
}

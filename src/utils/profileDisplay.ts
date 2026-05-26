import {
  onlyDigits,
  type ProfileEditSnapshot,
} from '@src/utils/profileEditForm';

export type DisplayProfile = {
  name: string;
  email: string;
  mobile: string;
  profilePictureUrl: string;
  profession: string;
  whatsapp: string;
};

export type DraftProfile = {
  name: string;
  profession: string;
  whatsappRaw: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  return value as Record<string, unknown>;
}

function firstString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === 'string') {
      const normalized = value.trim();
      if (normalized) {
        return normalized;
      }
    }
  }
  return '';
}

function optionalString(value: unknown): string {
  if (value == null) {
    return '';
  }
  if (typeof value === 'string') {
    return value.trim();
  }
  return '';
}

/** Normalize `data.user` (or similar) into display fields for profile screens. */
export function readProfileData(user: unknown): DisplayProfile {
  const row = asRecord(user);
  return {
    name: firstString(row?.name),
    email: firstString(row?.email),
    mobile: firstString(row?.mobile, row?.phone, row?.phone_number),
    profilePictureUrl: firstString(
      row?.profile_picture,
      row?.profile_image,
      row?.profile_image_url,
      row?.avatar,
      row?.avatar_url,
      row?.image_url,
      row?.image,
    ),
    profession: optionalString(row?.profession),
    whatsapp: optionalString(row?.whatsapp),
  };
}

export function toEditSnapshot(display: DisplayProfile): ProfileEditSnapshot {
  return {
    name: display.name.trim(),
    email: display.email.trim(),
    phoneDigits: onlyDigits(display.mobile),
    profilePictureUrl: display.profilePictureUrl.trim(),
    profession: display.profession.trim(),
    whatsappDigits: onlyDigits(display.whatsapp),
  };
}

export function draftFromSnapshot(s: ProfileEditSnapshot): DraftProfile {
  return {
    name: s.name,
    profession: s.profession,
    whatsappRaw: s.whatsappDigits,
  };
}

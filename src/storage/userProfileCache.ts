import AsyncStorage from '@react-native-async-storage/async-storage';

import type { UserProfile } from '@src/api/updateProfile';
import type { ProfileRoleResponse } from '@src/types/company';

const KEY = '@oneattendance/cachedUserProfileV1';

export type CachedUserProfile = {
  id: number | null;
  name: string;
  email: string;
  phone: string;
  profilePictureUrl: string;
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

function readId(row: Record<string, unknown>): number | null {
  const v = row.id;
  if (typeof v === 'number' && Number.isFinite(v)) {
    return v;
  }
  if (typeof v === 'string' && /^\d+$/.test(v.trim())) {
    return parseInt(v.trim(), 10);
  }
  return null;
}

/** Build cache row from `/users/profile-role` `data.user` or any compatible user object. */
export function cachedProfileFromUnknownUser(user: unknown): CachedUserProfile | null {
  const row = asRecord(user);
  if (!row) {
    return null;
  }
  const name = firstString(row.name);
  const email = firstString(row.email);
  const phone = firstString(row.mobile, row.phone, row.phone_number);
  const profilePictureUrl = firstString(
    row.profile_picture,
    row.profile_image,
    row.profile_image_url,
    row.avatar,
    row.avatar_url,
    row.image_url,
    row.image,
  );
  if (!name && !email && !phone && !profilePictureUrl && readId(row) == null) {
    return null;
  }
  return {
    id: readId(row),
    name,
    email,
    phone,
    profilePictureUrl,
  };
}

export function cachedProfileFromProfileRoleResponse(
  role: ProfileRoleResponse | null | undefined,
): CachedUserProfile | null {
  return cachedProfileFromUnknownUser(role?.data?.user);
}

export function mergeUserProfileIntoCachedProfile(
  user: UserProfile,
  prev: CachedUserProfile | null,
): CachedUserProfile {
  const base = prev ?? {
    id: null,
    name: '',
    email: '',
    phone: '',
    profilePictureUrl: '',
  };
  const pic = user.profile_picture?.trim() ?? '';
  return {
    id: typeof user.id === 'number' ? user.id : base.id,
    name: user.name?.trim() ? user.name.trim() : base.name,
    email: user.email?.trim() ? user.email.trim() : base.email,
    phone: user.phone != null && user.phone !== '' ? String(user.phone).trim() : base.phone,
    profilePictureUrl: pic || base.profilePictureUrl,
  };
}

export async function saveCachedUserProfile(profile: CachedUserProfile): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(profile));
}

export async function loadCachedUserProfile(): Promise<CachedUserProfile | null> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw?.trim()) {
    return null;
  }
  try {
    const o = JSON.parse(raw) as unknown;
    if (!o || typeof o !== 'object') {
      return null;
    }
    const row = o as Record<string, unknown>;
    const rawId = row.id;
    const id =
      typeof rawId === 'number' && Number.isFinite(rawId)
        ? rawId
        : typeof rawId === 'string' && /^\d+$/.test(rawId.trim())
          ? parseInt(rawId.trim(), 10)
          : null;
    return {
      id,
      name: typeof row.name === 'string' ? row.name : '',
      email: typeof row.email === 'string' ? row.email : '',
      phone: typeof row.phone === 'string' ? row.phone : '',
      profilePictureUrl: typeof row.profilePictureUrl === 'string' ? row.profilePictureUrl : '',
    };
  } catch {
    return null;
  }
}

export async function clearCachedUserProfile(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}

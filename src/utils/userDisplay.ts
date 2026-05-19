import type { CachedUserProfile } from '@src/storage/userProfileCache';
import type { ProfileRoleUser } from '@src/types/profileRoleUser';

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

export function profilePictureFromUser(user: ProfileRoleUser | unknown | null | undefined): string {
  const row = asRecord(user);
  if (!row) {
    return '';
  }
  return firstString(
    row.profile_picture,
    row.profile_image,
    row.profile_image_url,
    row.avatar,
    row.avatar_url,
    row.image_url,
    row.image,
  );
}

export function displayNameFromSources(
  authName: string | null,
  authEmail: string | null,
  cached: CachedUserProfile | null | undefined,
  profileUser: ProfileRoleUser | null | undefined,
): string {
  return (
    firstString(profileUser?.name, cached?.name, authName) ||
    firstString(profileUser?.email, cached?.email, authEmail).split('@')[0] ||
    ''
  );
}

export function displayEmailFromSources(
  authEmail: string | null,
  cached: CachedUserProfile | null | undefined,
  profileUser: ProfileRoleUser | null | undefined,
): string {
  return firstString(profileUser?.email, cached?.email, authEmail);
}

export function profilePictureFromSources(
  cached: CachedUserProfile | null | undefined,
  profileUser: ProfileRoleUser | null | undefined,
): string {
  return profilePictureFromUser(profileUser) || cached?.profilePictureUrl?.trim() || '';
}

export function initialsFromDisplayName(displayName: string, emailFallback: string): string {
  const fromName = displayName.trim();
  if (fromName) {
    const parts = fromName.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      const a = parts[0]?.[0];
      const b = parts[parts.length - 1]?.[0];
      if (a && b) {
        return `${a}${b}`.toUpperCase();
      }
    }
    const ch = fromName[0];
    return ch ? ch.toUpperCase() : '?';
  }
  const e = emailFallback.trim();
  if (e.length > 0) {
    return e[0]!.toUpperCase();
  }
  return '?';
}

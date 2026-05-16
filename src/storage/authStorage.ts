import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  token: '@oneattendance/authToken',
  email: '@oneattendance/userEmail',
  name: '@oneattendance/userName',
} as const;

export type StoredAuthSession = {
  token: string;
  email: string;
  name: string;
};

/** Default Async Storage instance (@react-native-async-storage/async-storage v3+). */
export async function saveAuthSession(session: StoredAuthSession): Promise<void> {
  await AsyncStorage.setMany({
    [KEYS.token]: session.token,
    [KEYS.email]: session.email,
    [KEYS.name]: session.name,
  });
}

export async function loadAuthSession(): Promise<{
  token: string | null;
  email: string | null;
  name: string | null;
}> {
  const rows = await AsyncStorage.getMany([
    KEYS.token,
    KEYS.email,
    KEYS.name,
  ]);
  return {
    token: rows[KEYS.token] ?? null,
    email: rows[KEYS.email] ?? null,
    name: rows[KEYS.name] ?? null,
  };
}

export async function clearAuthSession(): Promise<void> {
  await AsyncStorage.removeMany([KEYS.token, KEYS.email, KEYS.name]);
}

/** Updates stored display email/name after a successful profile update (token unchanged). */
export async function updateStoredAuthDisplayFields(partial: {
  email?: string | null;
  name?: string | null;
}): Promise<void> {
  const rows = await AsyncStorage.getMany([KEYS.token, KEYS.email, KEYS.name]);
  const token = rows[KEYS.token];
  if (!token?.trim()) {
    return;
  }
  const nextEmail = partial.email != null ? partial.email.trim() : (rows[KEYS.email] ?? '');
  const nextName = partial.name != null ? partial.name.trim() : (rows[KEYS.name] ?? '');
  await saveAuthSession({
    token,
    email: nextEmail,
    name: nextName,
  });
}


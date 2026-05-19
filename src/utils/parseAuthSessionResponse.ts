import type { StoredAuthSession } from '@src/storage/authStorage';

/**
 * Parses login/signup responses: `{ token, user }` or `{ success, data: { token, user } }`.
 */
export function parseAuthSessionResponse(
  body: unknown,
  fallbackEmail = '',
): StoredAuthSession | null {
  if (!body || typeof body !== 'object') {
    return null;
  }

  const root = body as Record<string, unknown>;
  const payload =
    root.data && typeof root.data === 'object'
      ? (root.data as Record<string, unknown>)
      : root;

  const rawToken =
    typeof payload.token === 'string' && payload.token.trim()
      ? payload.token.trim()
      : typeof root.token === 'string' && root.token.trim()
        ? root.token.trim()
        : typeof root.tooken === 'string' && root.tooken.trim()
          ? root.tooken.trim()
          : null;

  if (!rawToken) {
    return null;
  }

  let userEmail = fallbackEmail.trim();
  let userName = '';
  const user = payload.user ?? root.user;
  if (user && typeof user === 'object') {
    const u = user as { email?: unknown; name?: unknown };
    if (typeof u.email === 'string' && u.email.trim()) {
      userEmail = u.email.trim();
    }
    if (typeof u.name === 'string') {
      userName = u.name;
    }
  }

  return {
    token: rawToken,
    email: userEmail,
    name: userName,
  };
}

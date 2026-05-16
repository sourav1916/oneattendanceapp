import { useCallback, useState } from 'react';

import { type UpdateProfileRequestBody, type UserProfile, updateProfile } from '@src/api/updateProfile';
import { readApiError } from '@src/utils/readApiError';

/**
 * Minimal mutation wrapper around {@link updateProfile} (loading + surfaced error).
 *
 * @example
 * const { mutate, loading, error, resetError } = useUpdateProfile();
 * await mutate({ name: 'Jane' });
 */
export function useUpdateProfile() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetError = useCallback(() => setError(null), []);

  const mutate = useCallback(async (body: UpdateProfileRequestBody): Promise<UserProfile> => {
    setError(null);
    setLoading(true);
    try {
      return await updateProfile(body);
    } catch (e) {
      const msg = readApiError(e);
      setError(msg);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  return { mutate, loading, error, resetError };
}

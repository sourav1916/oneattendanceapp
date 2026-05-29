import { authHttpClient } from '@src/api/authHttpClient';
import type { ProfileRoleResponse } from '@src/types/company';

/** GET `/users/profile-role` — Bearer from {@link authHttpClient}. */
export async function fetchProfileRole(): Promise<ProfileRoleResponse> {
  const { data } = await authHttpClient.get<ProfileRoleResponse>('/users/profile-role', {
    maxBodyLength: Infinity,
  });

  return data;
}

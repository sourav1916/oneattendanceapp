import { authHttpClient } from '@src/api/authHttpClient';
import type { UserAvailabilityResponse } from '@src/types/userAvailability';

export type CheckUserAvailableParams =
  | { email: string }
  | { mobile: string };

function withCompany(companyId: number) {
  return { company: String(companyId) };
}

export const userAvailabilityApi = {
  async checkAvailable(
    companyId: number,
    params: CheckUserAvailableParams,
  ): Promise<UserAvailabilityResponse> {
    const { data } = await authHttpClient.get<UserAvailabilityResponse>(
      '/company/users/available',
      {
        headers: withCompany(companyId),
        params,
      },
    );

    return data;
  },
};

import { authHttpClient } from '@src/api/authHttpClient';
import type { GlobalConstantsResponse } from '@src/types/globalConstants';

export const constantsApi = {
  async list(): Promise<GlobalConstantsResponse> {
    const { data } = await authHttpClient.get<GlobalConstantsResponse>(
      '/constants',
    );
    return data;
  },
};

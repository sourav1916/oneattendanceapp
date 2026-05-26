import { authHttpClient } from '@src/api/authHttpClient';
import type {
  ApplyLeaveApiPayload,
  CancelLeavePayload,
  LeaveApiResponse,
  LeaveApplicationListResponse,
  UpdateLeaveApiPayload,
} from '@src/types/leaveApplication';

function withCompany(companyId: number) {
  return { company: String(companyId) };
}

export const leaveApi = {
  async getMyApplications(
    companyId: number,
    params: { page?: number; limit?: number },
  ): Promise<LeaveApplicationListResponse> {
    const { data } = await authHttpClient.get<LeaveApplicationListResponse>(
      '/leave/my-applications',
      {
        headers: withCompany(companyId),
        params: { page: params.page ?? 1, limit: params.limit ?? 10 },
      },
    );
    return data;
  },

  async apply(
    companyId: number,
    payload: ApplyLeaveApiPayload,
  ): Promise<LeaveApiResponse> {
    const { data } = await authHttpClient.post<LeaveApiResponse>(
      '/leave/apply',
      payload,
      { headers: withCompany(companyId) },
    );
    return data;
  },

  async update(
    companyId: number,
    payload: UpdateLeaveApiPayload,
  ): Promise<LeaveApiResponse> {
    const { data } = await authHttpClient.put<LeaveApiResponse>(
      '/leave/application-update',
      payload,
      { headers: withCompany(companyId) },
    );
    return data;
  },

  async cancel(
    companyId: number,
    payload: CancelLeavePayload,
  ): Promise<LeaveApiResponse> {
    const { data } = await authHttpClient.put<LeaveApiResponse>(
      '/leave/cancel',
      payload,
      { headers: withCompany(companyId) },
    );
    return data;
  },
};

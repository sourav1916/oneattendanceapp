import { authHttpClient } from '@src/api/authHttpClient';
import type { AttendanceListParams, AttendanceListResponse } from '@src/types/attendanceList';
import type {
  BulkApprovePayload,
  BulkApproveResponse,
  LeaveConfigResponse,
  MarkAttendancePayload,
  MarkAttendanceResponse,
} from '@src/types/markAttendance';

const DEFAULT_LIMIT = 20;

function withCompany(companyId: number) {
  return { company: String(companyId) };
}

export const attendanceApi = {
  /** GET `/attendance/list` — Bearer + `company` header; `type=attendance` only. */
  async getAttendanceList(
    companyId: number,
    params: AttendanceListParams = {},
  ): Promise<AttendanceListResponse> {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(100, Math.max(1, params.limit ?? DEFAULT_LIMIT));
    const search = params.search?.trim() ?? '';

    const { data } = await authHttpClient.get<AttendanceListResponse>('/attendance/list', {
      headers: withCompany(companyId),
      params: {
        type: 'attendance',
        from_date: params.from_date,
        to_date: params.to_date,
        page,
        limit,
        ...(params.employee_id != null ? { employee_id: params.employee_id } : {}),
        ...(params.day_status ? { day_status: params.day_status } : {}),
        ...(search.length > 0 ? { search } : {}),
      },
    });
    return data;
  },

  /** POST `/attendance/mark` — upsert attendance or break for an employee. */
  async markAttendance(
    companyId: number,
    payload: MarkAttendancePayload,
  ): Promise<MarkAttendanceResponse> {
    const { data } = await authHttpClient.post<MarkAttendanceResponse>(
      '/attendance/mark',
      payload,
      { headers: withCompany(companyId) },
    );
    return data;
  },

  /** PUT `/attendance/approve` — bulk approve / override attendance for multiple employees. */
  async bulkApprove(
    companyId: number,
    payload: BulkApprovePayload,
  ): Promise<BulkApproveResponse> {
    const { data } = await authHttpClient.put<BulkApproveResponse>(
      '/attendance/approve',
      payload,
      { headers: withCompany(companyId) },
    );
    return data;
  },

  /** GET `/leave/company` — fetch available leave codes. */
  async fetchLeaveConfigs(
    companyId: number,
    isPaid?: boolean,
  ): Promise<LeaveConfigResponse> {
    const { data } = await authHttpClient.get<LeaveConfigResponse>('/leave/company', {
      headers: withCompany(companyId),
      params: isPaid != null ? { is_paid: isPaid } : undefined,
    });
    return data;
  },
};

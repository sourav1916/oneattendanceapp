import { authHttpClient } from '@src/api/authHttpClient';
import type { AttendancePunchPayload, PunchActionResponse } from '@src/types/attendancePunch';

function withCompany(companyId: number) {
  return { company: String(companyId) };
}

export async function postPunchIn(
  companyId: number,
  body: AttendancePunchPayload,
): Promise<PunchActionResponse> {
  const { data } = await authHttpClient.post<PunchActionResponse>('/attendance/punch-in', body, {
    headers: withCompany(companyId),
    maxBodyLength: Infinity,
  });
  return data;
}

export async function postPunchOut(
  companyId: number,
  body: AttendancePunchPayload,
): Promise<PunchActionResponse> {
  const { data } = await authHttpClient.post<PunchActionResponse>('/attendance/punch-out', body, {
    headers: withCompany(companyId),
    maxBodyLength: Infinity,
  });
  return data;
}

export async function postBreakIn(
  companyId: number,
  body: AttendancePunchPayload,
): Promise<PunchActionResponse> {
  const { data } = await authHttpClient.post<PunchActionResponse>('/attendance/break-in', body, {
    headers: withCompany(companyId),
    maxBodyLength: Infinity,
  });
  return data;
}

export async function postBreakOut(
  companyId: number,
  body: AttendancePunchPayload,
): Promise<PunchActionResponse> {
  const { data } = await authHttpClient.post<PunchActionResponse>('/attendance/break-out', body, {
    headers: withCompany(companyId),
    maxBodyLength: Infinity,
  });
  return data;
}

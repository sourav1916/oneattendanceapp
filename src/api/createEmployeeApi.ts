import { authHttpClient } from '@src/api/authHttpClient';
import type {
  CreateEmployeeBody,
  CreateEmployeeResponse,
  RequestCreateEmployeeOtpBody,
  RequestCreateEmployeeOtpResponse,
} from '@src/types/createEmployee';

function withCompany(companyId: number) {
  return { company: String(companyId) };
}

export const createEmployeeApi = {
  async requestCreateOtp(
    companyId: number,
    body: RequestCreateEmployeeOtpBody,
  ): Promise<RequestCreateEmployeeOtpResponse> {
    const { data } = await authHttpClient.post<RequestCreateEmployeeOtpResponse>(
      '/employees/request-create-otp',
      body,
      { headers: withCompany(companyId) },
    );
    return data;
  },

  async createEmployee(
    companyId: number,
    body: CreateEmployeeBody,
  ): Promise<CreateEmployeeResponse> {
    const { data } = await authHttpClient.post<CreateEmployeeResponse>(
      '/employees/create',
      body,
      { headers: withCompany(companyId) },
    );
    return data;
  },
};

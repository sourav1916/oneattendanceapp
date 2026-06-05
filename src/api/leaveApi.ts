import { authHttpClient } from '@src/api/authHttpClient';
import type {
  AssignLeaveBalancePayload,
  AssignLeaveBalanceResponse,
  DeleteLeaveBalancePayload,
  DeleteLeaveBalanceResponse,
  EmpLeaveBalanceListResponse,
  FetchEmpLeaveBalancesParams,
  UpdateLeaveBalancePayload,
  UpdateLeaveBalanceResponse,
} from '@src/types/empLeaveBalance';
import type {
  EmpLeaveListResponse,
  FetchEmpLeavesParams,
} from '@src/types/employeeLeave';
import type {
  CompanyLeaveConfigListResponse,
  CreateLeaveConfigPayload,
  CreateLeaveConfigResponse,
  DeleteLeaveConfigPayload,
  DeleteLeaveConfigResponse,
  FetchCompanyLeaveConfigsParams,
  UpdateLeaveConfigPayload,
  UpdateLeaveConfigResponse,
} from '@src/types/leaveConfig';
import type {
  ApproveEditLeavePayload,
  ApproveEditLeaveResponse,
  BulkLeaveActionPayload,
  BulkLeaveActionResponse,
  CreateManagementLeavePayload,
  CreateManagementLeaveResponse,
  RejectLeavePayload,
  RejectLeaveResponse,
} from '@src/types/leaveManagement';
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
  async getEmpBalances(
    companyId: number,
    params: FetchEmpLeaveBalancesParams = {},
  ): Promise<EmpLeaveBalanceListResponse> {
    const query: Record<string, string | number> = {
      year: params.year ?? new Date().getFullYear(),
      page: params.page ?? 1,
      limit: Math.min(params.limit ?? 20, 50),
    };
    const search = params.search?.trim();
    if (search) {
      query.search = search;
    }
    const { data } = await authHttpClient.get<EmpLeaveBalanceListResponse>(
      '/leave/emp-balances',
      { headers: withCompany(companyId), params: query },
    );
    return data;
  },

  async assignBalance(
    companyId: number,
    payload: AssignLeaveBalancePayload,
  ): Promise<AssignLeaveBalanceResponse> {
    const { data } = await authHttpClient.post<AssignLeaveBalanceResponse>(
      '/leave/assign-balance',
      payload,
      { headers: withCompany(companyId) },
    );
    return data;
  },

  async updateBalance(
    companyId: number,
    payload: UpdateLeaveBalancePayload,
  ): Promise<UpdateLeaveBalanceResponse> {
    const { data } = await authHttpClient.put<UpdateLeaveBalanceResponse>(
      '/leave/update-balance',
      payload,
      { headers: withCompany(companyId) },
    );
    return data;
  },

  async deleteBalance(
    companyId: number,
    payload: DeleteLeaveBalancePayload,
  ): Promise<DeleteLeaveBalanceResponse> {
    const { data } = await authHttpClient.delete<DeleteLeaveBalanceResponse>(
      '/leave/delete-balance',
      { headers: withCompany(companyId), data: payload },
    );
    return data;
  },

  async getCompanyLeaveConfigs(
    companyId: number,
    params: FetchCompanyLeaveConfigsParams = {},
  ): Promise<CompanyLeaveConfigListResponse> {
    const query: Record<string, string | number | boolean> = {
      page: params.page ?? 1,
      limit: Math.min(params.limit ?? 20, 100),
    };
    const search = params.search?.trim();
    if (search) {
      query.search = search;
    }
    if (params.is_active != null) {
      query.is_active = params.is_active;
    }
    if (params.is_paid != null) {
      query.is_paid = params.is_paid;
    }
    const { data } = await authHttpClient.get<CompanyLeaveConfigListResponse>(
      '/leave/company',
      { headers: withCompany(companyId), params: query },
    );
    return data;
  },

  async createLeaveConfig(
    companyId: number,
    payload: CreateLeaveConfigPayload,
  ): Promise<CreateLeaveConfigResponse> {
    const { data } = await authHttpClient.post<CreateLeaveConfigResponse>(
      '/leave/create',
      payload,
      { headers: withCompany(companyId) },
    );
    return data;
  },

  async updateLeaveConfig(
    companyId: number,
    payload: UpdateLeaveConfigPayload,
  ): Promise<UpdateLeaveConfigResponse> {
    const { data } = await authHttpClient.put<UpdateLeaveConfigResponse>(
      '/leave/update',
      payload,
      { headers: withCompany(companyId) },
    );
    return data;
  },

  async deleteLeaveConfig(
    companyId: number,
    payload: DeleteLeaveConfigPayload,
  ): Promise<DeleteLeaveConfigResponse> {
    const { data } = await authHttpClient.delete<DeleteLeaveConfigResponse>(
      '/leave/delete',
      { headers: withCompany(companyId), data: payload },
    );
    return data;
  },

  async getEmpLeaves(
    companyId: number,
    params: FetchEmpLeavesParams = {},
  ): Promise<EmpLeaveListResponse> {
    const query: Record<string, string | number> = {
      page: params.page ?? 1,
      limit: Math.min(params.limit ?? 20, 50),
    };
    const search = params.search?.trim();
    if (search) {
      query.search = search;
    }
    if (params.status) {
      query.status = params.status;
    }
    if (params.start_date) {
      query.start_date = params.start_date;
    }
    if (params.end_date) {
      query.end_date = params.end_date;
    }
    const { data } = await authHttpClient.get<EmpLeaveListResponse>(
      '/leave/emp-leaves',
      { headers: withCompany(companyId), params: query },
    );
    return data;
  },

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

  async approveEdit(
    companyId: number,
    payload: ApproveEditLeavePayload,
  ): Promise<ApproveEditLeaveResponse> {
    const { data } = await authHttpClient.put<ApproveEditLeaveResponse>(
      '/leave/management/approve-edit',
      payload,
      { headers: withCompany(companyId) },
    );
    return data;
  },

  async bulkApproveReject(
    companyId: number,
    payload: BulkLeaveActionPayload,
  ): Promise<BulkLeaveActionResponse> {
    const { data } = await authHttpClient.put<BulkLeaveActionResponse>(
      '/leave/management/bulk-approve-reject',
      payload,
      { headers: withCompany(companyId) },
    );
    return data;
  },

  async rejectLeave(
    companyId: number,
    payload: RejectLeavePayload,
  ): Promise<RejectLeaveResponse> {
    const { data } = await authHttpClient.put<RejectLeaveResponse>(
      '/leave/reject',
      payload,
      { headers: withCompany(companyId) },
    );
    return data;
  },

  async createManagementLeave(
    companyId: number,
    payload: CreateManagementLeavePayload,
  ): Promise<CreateManagementLeaveResponse> {
    const { data } = await authHttpClient.post<CreateManagementLeaveResponse>(
      '/leave/management/create',
      payload,
      { headers: withCompany(companyId) },
    );
    return data;
  },
};

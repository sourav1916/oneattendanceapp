import { authHttpClient } from '@src/api/authHttpClient';
import type {
  BankAccountMutationResponse,
  CreateBankAccountPayload,
  DeleteBankAccountPayload,
  DeleteBankAccountResponse,
  FetchMyBankAccountsParams,
  IfscLookupResponse,
  MyBankAccountsResponse,
  UpdateBankAccountPayload,
} from '@src/types/bankAccount';

function withCompany(companyId: number) {
  return { company: String(companyId) };
}

export const bankAccountApi = {
  async lookupIfsc(ifscCode: string): Promise<IfscLookupResponse> {
    const code = ifscCode.trim().toUpperCase();
    const { data } = await authHttpClient.get<IfscLookupResponse>(
      `/bank-accounts/ifsc/${encodeURIComponent(code)}`,
    );
    return data;
  },

  async fetchMyAccounts(
    companyId: number,
    params?: FetchMyBankAccountsParams,
  ): Promise<MyBankAccountsResponse> {
    const { data } = await authHttpClient.get<MyBankAccountsResponse>(
      '/bank-accounts/my',
      {
        headers: withCompany(companyId),
        params: {
          page: params?.page ?? 1,
          limit: params?.limit ?? 20,
          ...(params?.search?.trim() ? { search: params.search.trim() } : {}),
          ...(params?.status ? { status: params.status } : {}),
          ...(params?.account_type ? { account_type: params.account_type } : {}),
          ...(params?.is_primary != null ? { is_primary: params.is_primary } : {}),
          ...(params?.sort_by ? { sort_by: params.sort_by } : {}),
          ...(params?.sort_order ? { sort_order: params.sort_order } : {}),
        },
      },
    );
    return data;
  },

  async createAccount(
    companyId: number,
    payload: CreateBankAccountPayload,
  ): Promise<BankAccountMutationResponse> {
    const { data } = await authHttpClient.post<BankAccountMutationResponse>(
      '/bank-accounts/create',
      payload,
      { headers: withCompany(companyId) },
    );
    return data;
  },

  async updateAccount(
    companyId: number,
    payload: UpdateBankAccountPayload,
  ): Promise<BankAccountMutationResponse> {
    const { data } = await authHttpClient.put<BankAccountMutationResponse>(
      '/bank-accounts/update',
      payload,
      { headers: withCompany(companyId) },
    );
    return data;
  },

  async deleteAccount(
    companyId: number,
    payload: DeleteBankAccountPayload,
  ): Promise<DeleteBankAccountResponse> {
    const { data } = await authHttpClient.delete<DeleteBankAccountResponse>(
      '/bank-accounts/delete',
      {
        headers: withCompany(companyId),
        data: payload,
      },
    );
    return data;
  },
};

/**
 * Minimal company row we persist and show in UI (from profile-role `data.companies`).
 */
export type StoredSelectedCompany = {
  id: number;
  name: string;
  logo_url: string | null;
  /** e.g. company_owner | employee */
  role?: string;
  /** Owned company vs employment */
  relation: 'owned' | 'employee';
};

export type ProfileCompanyPermission = {
  id?: number;
  action?: string;
  code?: string;
  name?: string;
  is_allowed?: number | boolean;
};

export type ProfileOwnedCompany = {
  id: number;
  name?: string;
  logo_url?: string | null;
  role?: string;
  permissions?: ProfileCompanyPermission[];
  [key: string]: unknown;
};

export type ProfileEmployeeCompany = {
  id: number;
  name?: string;
  logo_url?: string | null;
  role?: string;
  permissions?: ProfileCompanyPermission[];
  [key: string]: unknown;
};

export type ProfileRoleResponse = {
  success?: boolean;
  role?: string;
  message?: string;
  data?: {
    user?: unknown;
    companies?: {
      owned_companies?: ProfileOwnedCompany[];
      companies?: ProfileEmployeeCompany[];
    };
    meta?: unknown;
  };
};

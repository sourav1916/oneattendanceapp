import type {
  ProfileEmployeeCompany,
  ProfileOwnedCompany,
  ProfileRoleResponse,
  StoredSelectedCompany,
} from '@src/types/company';

export type ModuleKey =
  | 'createCompany'
  | 'attendance'
  | 'attendanceMgmt'
  | 'company'
  | 'report'
  | 'faceAttendance'
  | 'employee'
  | 'leaveReq'
  | 'leaveMgmt'
  | 'onboarding';

export type ModuleAccessResult = {
  allowed: boolean;
  reason?: 'no_company' | 'no_permission' | 'allowed';
};

type CompanyPermission = {
  code?: string;
  is_allowed?: number | boolean | string;
};

function isPermissionAllowed(
  permissions: CompanyPermission[] | undefined,
  codes: string[],
): boolean {
  if (!permissions?.length) {
    return false;
  }
  return permissions.some(p => {
    if (!p.code || !codes.includes(p.code)) {
      return false;
    }
    const val = p.is_allowed;
    return val === 1 || val === true || val === '1' || String(val).toLowerCase() === 'true';
  });
}

function companyPermissions(
  row: ProfileOwnedCompany | ProfileEmployeeCompany | undefined,
): CompanyPermission[] | undefined {
  if (row == null || !Array.isArray(row.permissions)) {
    return undefined;
  }
  return row.permissions as CompanyPermission[];
}

function findProfileCompany(
  profileRole: ProfileRoleResponse | null,
  companyId: number,
  relation: StoredSelectedCompany['relation'],
): ProfileOwnedCompany | ProfileEmployeeCompany | undefined {
  const bucket = profileRole?.data?.companies;
  if (!bucket) {
    return undefined;
  }
  if (relation === 'owned') {
    return bucket.owned_companies?.find(c => c.id === companyId);
  }
  return bucket.companies?.find(c => c.id === companyId);
}

const MODULE_PERMISSIONS: Record<ModuleKey, string[]> = {
  createCompany: [], // Always allowed
  attendance: ['att_punch', 'att_view_own'],
  attendanceMgmt: ['att_view_all', 'att_create', 'att_update', 'att_delete', 'att_verify'],
  company: [], // Allowed if company exists
  report: [
    'att_view_all',
    'att_view_own',
    'salary_view_own',
    'payroll_view',
    'payroll_view_all',
    'cmp_bank_view_all',
  ],
  faceAttendance: ['att_create'],
  employee: [
    'employee_create',
    'employee_view',
    'employee_view_all',
    'employee_update',
    'employee_delete',
    'invite_create',
    'invite_view_all',
    'shift_create',
    'shift_view',
    'shift_view_all',
    'shift_update',
  ],
  leaveReq: ['leave_apply', 'leave_view_own', 'leave_cancel_own'],
  leaveMgmt: [
    'leave_view_all',
    'leave_approve',
    'leave_reject',
    'leave_update',
    'leave_config_create',
    'leave_config_view',
    'leave_config_update',
    'leave_config_delete',
    'leave_balance_assign',
    'leave_balance_view_all',
  ],
  onboarding: ['invite_create', 'invite_view_all', 'invite_cancel', 'invite_resend'],
};

/**
 * Evaluates whether a home module is accessible for the currently selected company.
 * - When no company exists, only 'createCompany' is accessible.
 * - When owned company is selected, all modules are accessible.
 * - When employee company is selected, evaluates the employee's assigned permissions.
 */
export function checkModuleAccess(
  moduleKey: ModuleKey,
  selectedCompany: StoredSelectedCompany | null,
  profileRole: ProfileRoleResponse | null,
): ModuleAccessResult {
  // Global action: creating a company is always enabled regardless of company status.
  if (moduleKey === 'createCompany') {
    return { allowed: true, reason: 'allowed' };
  }

  // All other modules require a valid company.
  if (!selectedCompany) {
    return { allowed: false, reason: 'no_company' };
  }

  // Company owner has unrestricted administrative access across modules.
  if (selectedCompany.relation === 'owned') {
    return { allowed: true, reason: 'allowed' };
  }

  // Viewing company list / switcher is always allowed for any company member.
  if (moduleKey === 'company') {
    return { allowed: true, reason: 'allowed' };
  }

  // Check employee permissions.
  const row = findProfileCompany(profileRole, selectedCompany.id, 'employee');
  const perms = companyPermissions(row);
  const requiredCodes = MODULE_PERMISSIONS[moduleKey];

  if (!requiredCodes || requiredCodes.length === 0) {
    return { allowed: true, reason: 'allowed' };
  }

  const allowed = isPermissionAllowed(perms, requiredCodes);
  return {
    allowed,
    reason: allowed ? 'allowed' : 'no_permission',
  };
}

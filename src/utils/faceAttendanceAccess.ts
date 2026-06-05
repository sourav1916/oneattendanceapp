import type {
  ProfileEmployeeCompany,
  ProfileOwnedCompany,
  ProfileRoleResponse,
  StoredSelectedCompany,
} from '@src/types/company';

type CompanyPermission = {
  code?: string;
  is_allowed?: number | boolean;
};

function isPermissionAllowed(
  permissions: CompanyPermission[] | undefined,
  code: string,
): boolean {
  if (!permissions?.length) {
    return false;
  }
  return permissions.some(
    p =>
      p.code === code &&
      (p.is_allowed === 1 || p.is_allowed === true),
  );
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

/**
 * Face Attendance tab: company owners always; employees need `att_create` on profile-role.
 */
export function canShowFaceAttendanceTab(
  profileRole: ProfileRoleResponse | null,
  selectedCompany: StoredSelectedCompany | null,
): boolean {
  if (selectedCompany == null) {
    return false;
  }
  if (selectedCompany.relation === 'owned') {
    return true;
  }
  const row = findProfileCompany(
    profileRole,
    selectedCompany.id,
    'employee',
  );
  return isPermissionAllowed(companyPermissions(row), 'att_create');
}

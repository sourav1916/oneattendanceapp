import type { ProfileRoleResponse } from '@src/types/company';

/** Reads `employee_id` from profile-role employment row for the selected company. */
export function resolveMyEmployeeId(
  profileRole: ProfileRoleResponse | null,
  companyId: number | null,
): number | null {
  if (companyId == null || !profileRole?.data?.companies) {
    return null;
  }
  const rows = profileRole.data.companies.companies ?? [];
  const row = rows.find(c => c.id === companyId);
  if (!row) {
    return null;
  }
  const employeeId = row.employee_id;
  return typeof employeeId === 'number' && Number.isFinite(employeeId) ? employeeId : null;
}

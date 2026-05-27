import type { PermissionPackage } from '@src/types/employeeManagement';
import type { PermissionPackageListItem } from '@src/types/permissionPackageList';

function isActivePackage(item: PermissionPackageListItem): boolean {
  return item.is_active === 1 || item.is_active === true;
}

export function mapPermissionPackagesList(
  packages: PermissionPackageListItem[] | undefined,
): PermissionPackage[] {
  if (!Array.isArray(packages)) {
    return [];
  }
  return packages.filter(isActivePackage).map(item => ({
    id: item.id,
    name: item.package_name,
    description: item.description ?? null,
    group_code: item.group_code ?? null,
    permissions: (item.permissions ?? []).map(p => ({
      id: p.id,
      code: p.code,
      name: p.name,
      action: p.action,
    })),
  }));
}

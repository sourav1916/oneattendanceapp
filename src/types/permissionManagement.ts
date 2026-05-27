import type {
  PermissionPackageListItem,
  PermissionPackageListMeta,
  PermissionPackageListPermission,
} from '@src/types/permissionPackageList';

export type PermissionListItem = {
  id: number;
  code: string;
  name: string;
  action: string;
  category: string;
};

export type PermissionListResponse = {
  success: boolean;
  message: string;
  data: PermissionListItem[] | null;
};

export type PermissionPackageFormData = {
  package_name: string;
  group_code: string;
  description: string;
  permission_ids: number[];
};

export type PermissionPackageCreatePayload = {
  package_name: string;
  group_code?: string;
  description?: string;
  permissions: number[];
};

export type PermissionPackageUpdatePayload = {
  id: number;
  package_name: string;
  group_code?: string;
  description?: string;
  permissions: number[];
};

export type PermissionPackageCreateResponse = {
  success: boolean;
  message: string;
  data?: { package_id: number } | null;
};

export type PermissionPackageUpdateResponse = {
  success: boolean;
  message: string;
  data?: unknown;
};

export type PermissionPackageDeletePayload = {
  packageId: number;
};

export type PermissionPackageMutationResponse = {
  success: boolean;
  message: string;
};

export type { PermissionPackageListItem, PermissionPackageListMeta, PermissionPackageListPermission };

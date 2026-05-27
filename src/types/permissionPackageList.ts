export type PermissionPackageListPermission = {
  id: number;
  name: string;
  code: string;
  action: string;
  category?: string;
};

export type PermissionPackageListItem = {
  id: number;
  company_id: number;
  package_name: string;
  group_code: string | null;
  description: string | null;
  is_active: number | boolean;
  created_at?: string;
  created_by?: number | null;
  updated_at?: string;
  updated_by?: number | null;
  permissions: PermissionPackageListPermission[];
  total_used?: number;
  used_by?: unknown[];
};

export type PermissionPackageListMeta = {
  total: number;
  totalPages: number;
  page: number;
  limit: number;
  is_last_page: boolean;
};

export type PermissionPackageListData = {
  packages: PermissionPackageListItem[];
  meta?: PermissionPackageListMeta;
};

export type PermissionPackageListResponse = {
  success: boolean;
  message: string;
  data: PermissionPackageListData | null;
};

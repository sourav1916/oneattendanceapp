import { useCallback, useState } from 'react';

import { constantsApi } from '@src/api/constantsApi';
import { employeeManagementApi } from '@src/api/employeeManagementApi';
import { invitePackageApi } from '@src/api/invitePackageApi';
import type { PermissionPackage } from '@src/types/employeeManagement';
import type { InvitePackageItem } from '@src/types/invitePackage';
import type { InvitePackageFormConstants } from '@src/utils/mapGlobalConstants';
import { mapGlobalConstantsToFormConstants } from '@src/utils/mapGlobalConstants';
import { readApiError } from '@src/utils/readApiError';

const FORM_LIST_LIMIT = 100;

export function useOnboardInviteFormData(companyId: number | null) {
  const [loading, setLoading] = useState(false);
  const [constants, setConstants] = useState<InvitePackageFormConstants | null>(
    null,
  );
  const [invitePackages, setInvitePackages] = useState<InvitePackageItem[]>([]);
  const [permissionPackages, setPermissionPackages] = useState<
    PermissionPackage[]
  >([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (): Promise<{
    ok: boolean;
    error: string | null;
  }> => {
    if (companyId == null) {
      return { ok: false, error: null };
    }
    setLoading(true);
    setError(null);
    try {
      const [constantsRes, packagesRes, permissionRes] = await Promise.all([
        constantsApi.list(),
        invitePackageApi.list(companyId, {
          page: 1,
          limit: FORM_LIST_LIMIT,
        }),
        employeeManagementApi.getPermissionPackages(companyId, {
          search: '',
          page: 1,
          limit: FORM_LIST_LIMIT,
        }),
      ]);

      if (!constantsRes.success || !constantsRes.data) {
        const msg =
          constantsRes.message?.trim() || 'Could not load form options.';
        setError(msg);
        return { ok: false, error: msg };
      }
      setConstants(mapGlobalConstantsToFormConstants(constantsRes.data));

      if (!packagesRes.success) {
        const msg =
          packagesRes.message?.trim() || 'Could not load invite packages.';
        setError(msg);
        return { ok: false, error: msg };
      }
      const activePackages = (packagesRes.data ?? []).filter(p => p.is_active);
      setInvitePackages(activePackages);

      if (!permissionRes.success || !permissionRes.data) {
        const msg =
          permissionRes.message?.trim() ||
          'Could not load permission packages.';
        setError(msg);
        return { ok: false, error: msg };
      }
      setPermissionPackages(permissionRes.data);
      return { ok: true, error: null };
    } catch (e) {
      const msg = readApiError(e);
      setError(msg);
      return { ok: false, error: msg };
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  const reset = useCallback(() => {
    setConstants(null);
    setInvitePackages([]);
    setPermissionPackages([]);
    setError(null);
    setLoading(false);
  }, []);

  return {
    loading,
    constants,
    invitePackages,
    permissionPackages,
    error,
    load,
    reset,
  };
}

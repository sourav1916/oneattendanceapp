import { useCallback, useEffect, useRef, useState } from 'react';

import { constantsApi } from '@src/api/constantsApi';
import { employeeManagementApi } from '@src/api/employeeManagementApi';
import { invitePackageApi } from '@src/api/invitePackageApi';
import type { PermissionPackage } from '@src/types/employeeManagement';
import type { InvitePackageFormConstants } from '@src/utils/mapGlobalConstants';
import { mapGlobalConstantsToFormConstants } from '@src/utils/mapGlobalConstants';
import type {
  InvitePackageCreatePayload,
  InvitePackageItem,
  InvitePackageListMeta,
  InvitePackageUpdatePayload,
} from '@src/types/invitePackage';
import { readApiError } from '@src/utils/readApiError';

const PAGE_SIZE = 10;
const SEARCH_DEBOUNCE_MS = 500;

export type UseInvitePackagesOptions = {
  companyId: number | null;
  onError?: (message: string) => void;
  onSuccess?: (message: string) => void;
};

export function useInvitePackages({
  companyId,
  onError,
  onSuccess,
}: UseInvitePackagesOptions) {
  const [packages, setPackages] = useState<InvitePackageItem[]>([]);
  const [meta, setMeta] = useState<InvitePackageListMeta | null>(null);
  const [constants, setConstants] = useState<InvitePackageFormConstants | null>(
    null,
  );
  const [constantsLoading, setConstantsLoading] = useState(false);
  const [permissionPackages, setPermissionPackages] = useState<PermissionPackage[]>(
    [],
  );
  const [permissionPackagesLoading, setPermissionPackagesLoading] =
    useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearchRaw] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [mutating, setMutating] = useState(false);

  const fetchIdRef = useRef(0);
  const loadedPageRef = useRef(0);
  const endReachedLock = useRef(false);
  const onErrorRef = useRef(onError);
  const onSuccessRef = useRef(onSuccess);
  onErrorRef.current = onError;
  onSuccessRef.current = onSuccess;

  const constantsCacheRef = useRef<InvitePackageFormConstants | null>(null);
  const pkgCacheRef = useRef<{ companyId: number; data: PermissionPackage[] } | null>(null);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [search]);

  const setSearch = useCallback((v: string) => setSearchRaw(v), []);

  const loadFormConstants = useCallback(async () => {
    if (constantsCacheRef.current) {
      setConstants(constantsCacheRef.current);
      return;
    }
    setConstantsLoading(true);
    try {
      const res = await constantsApi.list();
      if (res.success && res.data) {
        const mapped = mapGlobalConstantsToFormConstants(res.data);
        constantsCacheRef.current = mapped;
        setConstants(mapped);
      } else {
        onErrorRef.current?.(
          res.message?.trim() || 'Could not load form options.',
        );
      }
    } catch (e) {
      onErrorRef.current?.(readApiError(e));
    } finally {
      setConstantsLoading(false);
    }
  }, []);

  const loadFormPermissionPackages = useCallback(async () => {
    if (companyId == null) {
      return;
    }
    if (pkgCacheRef.current?.companyId === companyId) {
      setPermissionPackages(pkgCacheRef.current.data);
      return;
    }
    setPermissionPackagesLoading(true);
    try {
      const res = await employeeManagementApi.getPermissionPackages(companyId);
      if (res.success && res.data) {
        pkgCacheRef.current = { companyId, data: res.data };
        setPermissionPackages(res.data);
      } else {
        onErrorRef.current?.(
          res.message?.trim() || 'Could not load permission packages.',
        );
      }
    } catch (e) {
      onErrorRef.current?.(readApiError(e));
    } finally {
      setPermissionPackagesLoading(false);
    }
  }, [companyId]);

  const loadFirst = useCallback(async () => {
    if (companyId == null) {
      setPackages([]);
      setMeta(null);
      setError(null);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    const fId = ++fetchIdRef.current;
    loadedPageRef.current = 0;
    setLoading(true);
    setError(null);
    endReachedLock.current = false;
    try {
      const res = await invitePackageApi.list(companyId, {
        search: debouncedSearch,
        page: 1,
        limit: PAGE_SIZE,
      });
      if (fId !== fetchIdRef.current) {
        return;
      }
      if (!res.success) {
        const msg = res.message?.trim() || 'Could not load packages.';
        setError(msg);
        onErrorRef.current?.(msg);
        setPackages([]);
        setMeta(null);
        return;
      }
      setPackages(res.data ?? []);
      setMeta(res.meta);
      loadedPageRef.current = 1;
    } catch (e) {
      if (fId !== fetchIdRef.current) {
        return;
      }
      const msg = readApiError(e);
      setError(msg);
      onErrorRef.current?.(msg);
      setPackages([]);
      setMeta(null);
    } finally {
      if (fId === fetchIdRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [companyId, debouncedSearch]);

  useEffect(() => {
    loadFirst().catch(() => { });
  }, [loadFirst]);

  const loadMore = useCallback(async () => {
    if (companyId == null || meta == null || loadingMore || loading) {
      return;
    }
    if (meta.is_last_page || (meta.total_pages > 0 && loadedPageRef.current >= meta.total_pages)) {
      return;
    }
    setLoadingMore(true);
    try {
      const nextPage = loadedPageRef.current + 1;
      const res = await invitePackageApi.list(companyId, {
        search: debouncedSearch,
        page: nextPage,
        limit: PAGE_SIZE,
      });
      const chunk = res.data;
      if (!res.success || chunk == null || chunk.length === 0) {
        if (chunk?.length === 0) {
          setMeta(m => (m ? { ...m, is_last_page: true } : m));
        }
        return;
      }
      loadedPageRef.current = nextPage;
      setPackages(prev => [...prev, ...chunk]);
      if (res.meta) {
        setMeta(res.meta);
      }
    } catch { /* keep list */ } finally {
      setLoadingMore(false);
      endReachedLock.current = false;
    }
  }, [companyId, meta, debouncedSearch, loadingMore, loading]);

  const refresh = useCallback(() => {
    setRefreshing(true);
    loadFirst().catch(() => { });
  }, [loadFirst]);

  const retry = useCallback(() => {
    loadFirst().catch(() => { });
  }, [loadFirst]);

  const tryLoadMore = useCallback(() => {
    if (endReachedLock.current || loading || loadingMore || meta == null) {
      return;
    }
    if (meta.is_last_page || (meta.total_pages > 0 && loadedPageRef.current >= meta.total_pages)) {
      return;
    }
    endReachedLock.current = true;
    loadMore().catch(() => { });
  }, [loadMore, loading, loadingMore, meta]);

  const createPackage = useCallback(async (payload: InvitePackageCreatePayload): Promise<boolean> => {
    if (companyId == null) {
      return false;
    }
    setMutating(true);
    try {
      const res = await invitePackageApi.create(companyId, payload);
      if (res.success) {
        onSuccessRef.current?.(res.message || 'Package created.');
        loadFirst().catch(() => { });
        return true;
      }
      onErrorRef.current?.(res.message || 'Create failed.');
      return false;
    } catch (e) {
      onErrorRef.current?.(readApiError(e));
      return false;
    } finally {
      setMutating(false);
    }
  }, [companyId, loadFirst]);

  const updatePackage = useCallback(async (payload: InvitePackageUpdatePayload): Promise<boolean> => {
    if (companyId == null) {
      return false;
    }
    setMutating(true);
    try {
      const res = await invitePackageApi.update(companyId, payload);
      if (res.success) {
        onSuccessRef.current?.(res.message || 'Package updated.');
        loadFirst().catch(() => { });
        return true;
      }
      onErrorRef.current?.(res.message || 'Update failed.');
      return false;
    } catch (e) {
      onErrorRef.current?.(readApiError(e));
      return false;
    } finally {
      setMutating(false);
    }
  }, [companyId, loadFirst]);

  const deletePackage = useCallback(async (packageId: number): Promise<boolean> => {
    if (companyId == null) {
      return false;
    }
    setMutating(true);
    try {
      const res = await invitePackageApi.remove(companyId, packageId);
      if (res.success) {
        onSuccessRef.current?.(res.message || 'Package deleted.');
        loadFirst().catch(() => { });
        return true;
      }
      onErrorRef.current?.(res.message || 'Delete failed.');
      return false;
    } catch (e) {
      onErrorRef.current?.(readApiError(e));
      return false;
    } finally {
      setMutating(false);
    }
  }, [companyId, loadFirst]);

  const toggleActive = useCallback(async (pkg: InvitePackageItem): Promise<boolean> => {
    return updatePackage({ package_id: pkg.id, is_active: !pkg.is_active });
  }, [updatePackage]);

  return {
    packages,
    meta,
    constants,
    constantsLoading,
    loadFormConstants,
    loadFormPermissionPackages,
    permissionPackages,
    permissionPackagesLoading,
    loading,
    loadingMore,
    refreshing,
    error,
    search,
    setSearch,
    refresh,
    loadMore: tryLoadMore,
    retry,
    createPackage,
    updatePackage,
    deletePackage,
    toggleActive,
    mutating,
  };
}

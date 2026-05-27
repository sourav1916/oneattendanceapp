import { useCallback, useEffect, useRef, useState } from 'react';

import { permissionManagementApi } from '@src/api/permissionManagementApi';
import type {
  PermissionListItem,
  PermissionPackageCreatePayload,
  PermissionPackageListItem,
  PermissionPackageListMeta,
  PermissionPackageUpdatePayload,
} from '@src/types/permissionManagement';
import { readApiError } from '@src/utils/readApiError';

const PAGE_SIZE = 10;
const SEARCH_DEBOUNCE_MS = 500;

export type UsePermissionPackagesOptions = {
  companyId: number | null;
  onError?: (message: string) => void;
  onSuccess?: (message: string) => void;
};

export function usePermissionPackages({
  companyId,
  onError,
  onSuccess,
}: UsePermissionPackagesOptions) {
  const [packages, setPackages] = useState<PermissionPackageListItem[]>([]);
  const [meta, setMeta] = useState<PermissionPackageListMeta | null>(null);
  const [allPermissions, setAllPermissions] = useState<PermissionListItem[]>(
    [],
  );
  const [permissionsLoading, setPermissionsLoading] = useState(false);
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
  const permissionsCacheRef = useRef<PermissionListItem[] | null>(null);
  const onErrorRef = useRef(onError);
  const onSuccessRef = useRef(onSuccess);
  onErrorRef.current = onError;
  onSuccessRef.current = onSuccess;

  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [search]);

  const setSearch = useCallback((v: string) => setSearchRaw(v), []);

  const loadPermissions = useCallback(async () => {
    if (permissionsCacheRef.current) {
      setAllPermissions(permissionsCacheRef.current);
      return;
    }
    setPermissionsLoading(true);
    try {
      const res = await permissionManagementApi.listPermissions();
      if (res.success && res.data) {
        permissionsCacheRef.current = res.data;
        setAllPermissions(res.data);
      } else {
        onErrorRef.current?.(
          res.message?.trim() || 'Could not load permissions.',
        );
      }
    } catch (e) {
      onErrorRef.current?.(readApiError(e));
    } finally {
      setPermissionsLoading(false);
    }
  }, []);

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
      const res = await permissionManagementApi.listPackages(companyId, {
        search: debouncedSearch,
        page: 1,
        limit: PAGE_SIZE,
      });
      if (fId !== fetchIdRef.current) {
        return;
      }
      if (!res.success) {
        const msg = res.message?.trim() || 'Could not load permission packages.';
        setError(msg);
        onErrorRef.current?.(msg);
        setPackages([]);
        setMeta(null);
        return;
      }
      setPackages(res.data?.packages ?? []);
      setMeta(res.data?.meta ?? null);
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
    loadFirst().catch(() => {});
  }, [loadFirst]);

  const loadMore = useCallback(async () => {
    if (companyId == null || meta == null || loadingMore || loading) {
      return;
    }
    if (
      meta.is_last_page ||
      (meta.totalPages > 0 && loadedPageRef.current >= meta.totalPages)
    ) {
      return;
    }
    setLoadingMore(true);
    try {
      const nextPage = loadedPageRef.current + 1;
      const res = await permissionManagementApi.listPackages(companyId, {
        search: debouncedSearch,
        page: nextPage,
        limit: PAGE_SIZE,
      });
      const chunk = res.data?.packages;
      if (!res.success || chunk == null || chunk.length === 0) {
        if (chunk?.length === 0) {
          setMeta(m => (m ? { ...m, is_last_page: true } : m));
        }
        return;
      }
      loadedPageRef.current = nextPage;
      setPackages(prev => [...prev, ...chunk]);
      if (res.data?.meta) {
        setMeta(res.data.meta);
      }
    } catch {
      /* keep list */
    } finally {
      setLoadingMore(false);
      endReachedLock.current = false;
    }
  }, [companyId, meta, debouncedSearch, loadingMore, loading]);

  const refresh = useCallback(() => {
    setRefreshing(true);
    loadFirst().catch(() => {});
  }, [loadFirst]);

  const retry = useCallback(() => {
    loadFirst().catch(() => {});
  }, [loadFirst]);

  const tryLoadMore = useCallback(() => {
    if (endReachedLock.current || loading || loadingMore || meta == null) {
      return;
    }
    if (
      meta.is_last_page ||
      (meta.totalPages > 0 && loadedPageRef.current >= meta.totalPages)
    ) {
      return;
    }
    endReachedLock.current = true;
    loadMore().catch(() => {});
  }, [loadMore, loading, loadingMore, meta]);

  const createPackage = useCallback(
    async (payload: PermissionPackageCreatePayload): Promise<boolean> => {
      if (companyId == null) {
        return false;
      }
      setMutating(true);
      try {
        const res = await permissionManagementApi.createPackage(
          companyId,
          payload,
        );
        if (res.success) {
          onSuccessRef.current?.(res.message || 'Package created.');
          loadFirst().catch(() => {});
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
    },
    [companyId, loadFirst],
  );

  const updatePackage = useCallback(
    async (payload: PermissionPackageUpdatePayload): Promise<boolean> => {
      if (companyId == null) {
        return false;
      }
      setMutating(true);
      try {
        const res = await permissionManagementApi.updatePackage(
          companyId,
          payload,
        );
        if (res.success) {
          onSuccessRef.current?.(res.message || 'Package updated.');
          loadFirst().catch(() => {});
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
    },
    [companyId, loadFirst],
  );

  const deletePackage = useCallback(
    async (packageId: number): Promise<boolean> => {
      if (companyId == null) {
        return false;
      }
      setMutating(true);
      try {
        const res = await permissionManagementApi.deletePackage(companyId, {
          packageId,
        });
        if (res.success) {
          onSuccessRef.current?.(res.message || 'Package deleted.');
          loadFirst().catch(() => {});
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
    },
    [companyId, loadFirst],
  );

  return {
    packages,
    meta,
    allPermissions,
    permissionsLoading,
    loadPermissions,
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
    mutating,
  };
};

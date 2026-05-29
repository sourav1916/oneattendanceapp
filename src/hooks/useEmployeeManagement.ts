import { useCallback, useEffect, useRef, useState } from 'react';

import { constantsApi } from '@src/api/constantsApi';
import { employeeManagementApi } from '@src/api/employeeManagementApi';
import { fetchEmployeeList } from '@src/api/fetchEmployeeList';
import { mapGlobalConstantsToFormConstants } from '@src/utils/mapGlobalConstants';
import type {
  CompanyConstants,
  EmployeeListItem,
  EmployeeListMeta,
  EmployeeUpdatePayload,
  PermissionPackage,
} from '@src/types/employeeManagement';
import { readApiError } from '@src/utils/readApiError';

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 500;

export type UseEmployeeManagementOptions = {
  companyId: number | null;
  onError?: (message: string) => void;
  onSuccess?: (message: string) => void;
};

export type UseEmployeeManagementResult = {
  employees: EmployeeListItem[];
  meta: EmployeeListMeta | null;
  constants: CompanyConstants | null;
  permissionPackages: PermissionPackage[];
  loading: boolean;
  loadingMore: boolean;
  refreshing: boolean;
  constantsLoading: boolean;
  permissionPackagesLoading: boolean;
  formOptionsLoading: boolean;
  loadFormOptions: (force?: boolean) => Promise<void>;
  error: string | null;
  search: string;
  setSearch: (value: string) => void;
  refresh: () => void;
  loadMore: () => void;
  retry: () => void;
  updateEmployee: (payload: EmployeeUpdatePayload) => Promise<boolean>;
  deleteEmployee: (employeeId: number) => Promise<boolean>;
  mutating: boolean;
};

export function useEmployeeManagement({
  companyId,
  onError,
  onSuccess,
}: UseEmployeeManagementOptions): UseEmployeeManagementResult {
  const [employees, setEmployees] = useState<EmployeeListItem[]>([]);
  const [meta, setMeta] = useState<EmployeeListMeta | null>(null);
  const [constants, setConstants] = useState<CompanyConstants | null>(null);
  const [permissionPackages, setPermissionPackages] = useState<
    PermissionPackage[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [constantsLoading, setConstantsLoading] = useState(false);
  const [permissionPackagesLoading, setPermissionPackagesLoading] =
    useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearchRaw] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [mutating, setMutating] = useState(false);

  const fetchFirstIdRef = useRef(0);
  const loadedPageRef = useRef(0);
  const endReachedLock = useRef(false);
  const onErrorRef = useRef(onError);
  const onSuccessRef = useRef(onSuccess);
  onErrorRef.current = onError;
  onSuccessRef.current = onSuccess;

  const constantsCacheRef = useRef<{ companyId: number; data: CompanyConstants } | null>(null);
  const packagesCacheRef = useRef<{ companyId: number; data: PermissionPackage[] } | null>(null);

  useEffect(() => {
    const id = setTimeout(
      () => setDebouncedSearch(search.trim()),
      SEARCH_DEBOUNCE_MS,
    );
    return () => clearTimeout(id);
  }, [search]);

  const setSearch = useCallback((value: string) => {
    setSearchRaw(value);
  }, []);

  const loadConstants = useCallback(
    async (force = false) => {
      if (companyId == null) {
        return;
      }
      if (
        !force &&
        constantsCacheRef.current?.companyId === companyId
      ) {
        setConstants(constantsCacheRef.current.data);
        return;
      }
      setConstantsLoading(true);
      try {
        const globalRes = await constantsApi.list();
        if (globalRes.success && globalRes.data) {
          const mapped = mapGlobalConstantsToFormConstants(globalRes.data);
          const data: CompanyConstants = {
            ...mapped,
            employment_statuses: [],
          };
          constantsCacheRef.current = { companyId, data };
          setConstants(data);
          return;
        }

        const companyRes =
          await employeeManagementApi.getConstants(companyId);
        if (companyRes.success && companyRes.data) {
          constantsCacheRef.current = { companyId, data: companyRes.data };
          setConstants(companyRes.data);
        }
      } catch {
        /* constants failure is non-blocking */
      } finally {
        setConstantsLoading(false);
      }
    },
    [companyId],
  );

  const loadPermissionPackages = useCallback(
    async (force = false) => {
      if (companyId == null) {
        return;
      }
      if (
        !force &&
        packagesCacheRef.current?.companyId === companyId
      ) {
        setPermissionPackages(packagesCacheRef.current.data);
        return;
      }
      setPermissionPackagesLoading(true);
      try {
        const res =
          await employeeManagementApi.getAllPermissionPackages(companyId);
        if (res.success && res.data) {
          packagesCacheRef.current = { companyId, data: res.data };
          setPermissionPackages(res.data);
        }
      } catch {
        /* non-blocking */
      } finally {
        setPermissionPackagesLoading(false);
      }
    },
    [companyId],
  );

  const loadFormOptions = useCallback(
    async (force = false) => {
      await Promise.all([
        loadConstants(force),
        loadPermissionPackages(force),
      ]);
    },
    [loadConstants, loadPermissionPackages],
  );

  const loadFirst = useCallback(async () => {
    if (companyId == null) {
      setEmployees([]);
      setMeta(null);
      setError(null);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    const fetchId = ++fetchFirstIdRef.current;
    loadedPageRef.current = 0;
    setLoading(true);
    setError(null);
    endReachedLock.current = false;
    try {
      const res = await fetchEmployeeList(companyId, {
        search: debouncedSearch,
        page: 1,
        limit: PAGE_SIZE,
      });
      if (fetchId !== fetchFirstIdRef.current) {
        return;
      }
      if (!res.success) {
        const msg = res.message?.trim() || 'Could not load employees.';
        setError(msg);
        onErrorRef.current?.(msg);
        setEmployees([]);
        setMeta(null);
        return;
      }
      setEmployees(res.data ?? []);
      setMeta(res.meta);
      loadedPageRef.current = 1;
    } catch (e) {
      if (fetchId !== fetchFirstIdRef.current) {
        return;
      }
      const msg = readApiError(e);
      setError(msg);
      onErrorRef.current?.(msg);
      setEmployees([]);
      setMeta(null);
    } finally {
      if (fetchId === fetchFirstIdRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [companyId, debouncedSearch]);

  useEffect(() => {
    loadFirst().catch(() => { });
  }, [loadFirst]);

  useEffect(() => {
    loadFormOptions().catch(() => { });
  }, [loadFormOptions]);

  const loadMore = useCallback(async () => {
    if (
      companyId == null ||
      meta == null ||
      loadingMore ||
      loading
    ) {
      return;
    }
    if (meta.is_last_page) {
      return;
    }
    if (meta.total_pages > 0 && loadedPageRef.current >= meta.total_pages) {
      return;
    }
    setLoadingMore(true);
    try {
      const nextPage = loadedPageRef.current + 1;
      const res = await fetchEmployeeList(companyId, {
        search: debouncedSearch,
        page: nextPage,
        limit: PAGE_SIZE,
      });

      const chunk = res.data;
      if (!res.success || chunk == null) {
        return;
      }
      if (chunk.length === 0) {
        setMeta(m => (m ? { ...m, is_last_page: true } : m));
        return;
      }
      loadedPageRef.current = nextPage;
      setEmployees(prev => [...prev, ...chunk]);
      setMeta(prev => {
        if (res.meta == null) {
          return prev;
        }
        return {
          ...res.meta,
          active: res.meta.active ?? prev?.active,
          inactive: res.meta.inactive ?? prev?.inactive,
        };
      });
    } catch {
      /* keep existing list */
    } finally {
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
    if (meta.is_last_page) {
      return;
    }
    if (meta.total_pages > 0 && loadedPageRef.current >= meta.total_pages) {
      return;
    }
    endReachedLock.current = true;
    loadMore().catch(() => { });
  }, [loadMore, loading, loadingMore, meta]);

  const updateEmployee = useCallback(
    async (payload: EmployeeUpdatePayload): Promise<boolean> => {
      if (companyId == null) {
        return false;
      }
      setMutating(true);
      try {
        const res = await employeeManagementApi.updateEmployee(
          companyId,
          payload,
        );
        if (res.success) {
          onSuccessRef.current?.(res.message || 'Employee updated.');
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
    },
    [companyId, loadFirst],
  );

  const deleteEmployee = useCallback(
    async (employeeId: number): Promise<boolean> => {
      if (companyId == null) {
        return false;
      }
      setMutating(true);
      try {
        const res = await employeeManagementApi.deleteEmployee(companyId, {
          employee_id: employeeId,
        });
        if (res.success) {
          onSuccessRef.current?.(res.message || 'Employee deleted.');
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
    },
    [companyId, loadFirst],
  );

  return {
    employees,
    meta,
    constants,
    permissionPackages,
    loading,
    loadingMore,
    refreshing,
    constantsLoading,
    permissionPackagesLoading,
    formOptionsLoading: constantsLoading || permissionPackagesLoading,
    loadFormOptions,
    error,
    search,
    setSearch,
    refresh,
    loadMore: tryLoadMore,
    retry,
    updateEmployee,
    deleteEmployee,
    mutating,
  };
}

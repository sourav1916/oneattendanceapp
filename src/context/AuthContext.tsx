import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { configureAuthHttpClient } from '@src/api/authHttpClient';
import { fetchProfileRole } from '@src/api/fetchProfileRole';
import type { UserProfile } from '@src/api/updateProfile';
import type { StoredAuthSession } from '@src/storage/authStorage';
import {
  clearAuthSession,
  loadAuthSession,
  saveAuthSession,
  updateStoredAuthDisplayFields,
} from '@src/storage/authStorage';
import {
  clearSelectedCompany,
  loadSelectedCompany,
  saveSelectedCompany,
} from '@src/storage/companyStorage';
import type { CachedUserProfile } from '@src/storage/userProfileCache';
import {
  cachedProfileFromProfileRoleResponse,
  clearCachedUserProfile,
  loadCachedUserProfile,
  mergeUserProfileIntoCachedProfile,
  saveCachedUserProfile,
} from '@src/storage/userProfileCache';
import type { ProfileRoleResponse, StoredSelectedCompany } from '@src/types/company';

type AuthContextValue = {
  /** `true` once AsyncStorage has been read at launch. */
  hydrated: boolean;
  token: string | null;
  email: string | null;
  name: string | null;
  selectedCompany: StoredSelectedCompany | null;
  /** Last successful `/users/profile-role` payload. */
  profileRole: ProfileRoleResponse | null;
  profileRoleLoading: boolean;
  /** Last persisted user summary (from profile-role); for UI when API not refetched. */
  cachedUserProfile: CachedUserProfile | null;
  signIn: (session: StoredAuthSession) => Promise<void>;
  signOut: () => Promise<void>;
  /** Refetch profile/companies with the current access token. Returns the fetched payload when successful. */
  refreshProfileRole: () => Promise<ProfileRoleResponse | null>;
  /** Persist and reflect name/email in session after a successful profile update. */
  applySessionDisplayFromProfile: (updates: { name?: string; email?: string }) => Promise<void>;
  /** Merge full user row from PUT `/users/update-profile` into session + profile-role cache. */
  applySessionFromProfileUpdate: (user: UserProfile) => Promise<void>;
  selectCompany: (company: StoredSelectedCompany) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(null);
  const [selectedCompany, setSelectedCompany] =
    useState<StoredSelectedCompany | null>(null);
  const [profileRole, setProfileRole] = useState<ProfileRoleResponse | null>(null);
  const [profileRoleLoading, setProfileRoleLoading] = useState(false);
  const [cachedUserProfile, setCachedUserProfile] = useState<CachedUserProfile | null>(null);

  /** Same value as `token` state; updated synchronously before any auth API call. */
  const tokenRef = useRef<string | null>(null);

  const loadProfileForToken = useCallback(async (): Promise<ProfileRoleResponse | null> => {
    const t = tokenRef.current?.trim();
    if (!t) {
      setProfileRole(null);
      return null;
    }
    setProfileRoleLoading(true);
    try {
      const data = await fetchProfileRole();
      setProfileRole(data);
      const snap = cachedProfileFromProfileRoleResponse(data);
      if (snap) {
        await saveCachedUserProfile(snap);
        setCachedUserProfile(snap);
      }
      return data;
    } catch {
      setProfileRole(null);
      return null;
    } finally {
      setProfileRoleLoading(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    tokenRef.current = null;
    await clearAuthSession();
    await clearCachedUserProfile();
    await clearSelectedCompany();
    setToken(null);
    setEmail(null);
    setName(null);
    setSelectedCompany(null);
    setProfileRole(null);
    setCachedUserProfile(null);
  }, []);

  const signOutRef = useRef(signOut);
  signOutRef.current = signOut;

  useLayoutEffect(() => {
    tokenRef.current = token;
  }, [token]);

  useLayoutEffect(() => {
    configureAuthHttpClient({
      getAccessToken: () => tokenRef.current,
      onUnauthorized: async () => {
        await signOutRef.current();
      },
    });
  }, []);

  useEffect(() => {
    let cancelled = false;

    Promise.all([loadAuthSession(), loadSelectedCompany(), loadCachedUserProfile()]).then(
      ([s, company, cached]) => {
        if (cancelled) {
          return;
        }
        tokenRef.current = s.token;
        setToken(s.token);
        setEmail(s.email);
        setName(s.name);
        setSelectedCompany(company);
        setCachedUserProfile(cached);
        setHydrated(true);

        if (s.token?.trim()) {
          loadProfileForToken().catch(() => {});
        }
      },
    );

    return () => {
      cancelled = true;
    };
  }, [loadProfileForToken]);

  const signIn = useCallback(
    async (session: StoredAuthSession) => {
      await saveAuthSession(session);
      tokenRef.current = session.token;
      setToken(session.token);
      setEmail(session.email);
      setName(session.name);
      await loadProfileForToken();
    },
    [loadProfileForToken],
  );

  const refreshProfileRole = useCallback(async () => loadProfileForToken(), [loadProfileForToken]);

  const applySessionDisplayFromProfile = useCallback(
    async (updates: { name?: string; email?: string }) => {
      const patch: { name?: string | null; email?: string | null } = {};
      if (updates.name !== undefined) {
        patch.name = updates.name.trim();
      }
      if (updates.email !== undefined) {
        patch.email = updates.email.trim();
      }
      if (Object.keys(patch).length === 0) {
        return;
      }
      await updateStoredAuthDisplayFields(patch);
      if (updates.name !== undefined) {
        setName(updates.name.trim() || null);
      }
      if (updates.email !== undefined) {
        setEmail(updates.email.trim() || null);
      }
    },
    [],
  );

  const applySessionFromProfileUpdate = useCallback(async (user: UserProfile) => {
    await updateStoredAuthDisplayFields({
      name: user.name,
      email: user.email,
    });
    setName(user.name?.trim() ? user.name.trim() : null);
    setEmail(user.email?.trim() ? user.email.trim() : null);
    setProfileRole(prev => {
      if (!prev?.data) {
        return prev;
      }
      const prevUser =
        prev.data.user && typeof prev.data.user === 'object'
          ? (prev.data.user as Record<string, unknown>)
          : {};
      return {
        ...prev,
        data: {
          ...prev.data,
          user: { ...prevUser, ...user },
        },
      };
    });
    setCachedUserProfile(prev => {
      const next = mergeUserProfileIntoCachedProfile(user, prev);
      void saveCachedUserProfile(next);
      return next;
    });
  }, []);

  const selectCompany = useCallback(async (company: StoredSelectedCompany) => {
    await saveSelectedCompany(company);
    setSelectedCompany(company);
  }, []);

  const value = useMemo(
    (): AuthContextValue => ({
      hydrated,
      token,
      email,
      name,
      selectedCompany,
      profileRole,
      profileRoleLoading,
      cachedUserProfile,
      signIn,
      signOut,
      refreshProfileRole,
      applySessionDisplayFromProfile,
      applySessionFromProfileUpdate,
      selectCompany,
    }),
    [
      hydrated,
      token,
      email,
      name,
      selectedCompany,
      profileRole,
      profileRoleLoading,
      cachedUserProfile,
      signIn,
      signOut,
      refreshProfileRole,
      applySessionDisplayFromProfile,
      applySessionFromProfileUpdate,
      selectCompany,
    ],
  );

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}

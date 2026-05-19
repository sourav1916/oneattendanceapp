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
  loadProfileRoleUser,
  mergeUserProfileIntoCachedProfile,
  saveCachedUserProfile,
  saveProfileRoleUser,
} from '@src/storage/userProfileCache';
import type { ProfileRoleUser } from '@src/types/profileRoleUser';
import type { ProfileRoleResponse, StoredSelectedCompany } from '@src/types/company';
import {
  companiesFromProfileRole,
  companiesListEqual,
} from '@src/utils/companiesFromProfileRole';

export type RefreshProfileRoleOptions = {
  /** Skip `profileRoleLoading` so {@link CompanySelectionGate} does not block the app. */
  silent?: boolean;
};

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
  /** Full `data.user` from last profile-role (persisted + in memory after fetch). */
  profileRoleUser: ProfileRoleUser | null;
  signIn: (session: StoredAuthSession) => Promise<void>;
  signOut: () => Promise<void>;
  /** Refetch profile/companies with the current access token. Returns the fetched payload when successful. */
  refreshProfileRole: (options?: RefreshProfileRoleOptions) => Promise<ProfileRoleResponse | null>;
  /** Persist and reflect name/email in session after a successful profile update. */
  applySessionDisplayFromProfile: (updates: { name?: string; email?: string }) => Promise<void>;
  /** Merge full user row from PUT `/users/update-profile` into session + profile-role cache. */
  applySessionFromProfileUpdate: (user: Partial<UserProfile>) => Promise<void>;
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
  const [profileRoleUser, setProfileRoleUser] = useState<ProfileRoleUser | null>(null);

  /** Same value as `token` state; updated synchronously before any auth API call. */
  const tokenRef = useRef<string | null>(null);

  const applyProfileRoleUserToSession = useCallback((snap: CachedUserProfile | null) => {
    if (!snap) {
      return;
    }
    const n = snap.name.trim();
    const e = snap.email.trim();
    if (n) {
      setName(n);
    }
    if (e) {
      setEmail(e);
    }
  }, []);

  const persistProfileRolePayload = useCallback(
    async (data: ProfileRoleResponse | null) => {
      if (data?.data?.user != null) {
        await saveProfileRoleUser(data.data.user);
        setProfileRoleUser(data.data.user as ProfileRoleUser);
      }
      const snap = cachedProfileFromProfileRoleResponse(data);
      if (snap) {
        await saveCachedUserProfile(snap);
        setCachedUserProfile(snap);
        applyProfileRoleUserToSession(snap);
      }
    },
    [applyProfileRoleUserToSession],
  );

  const loadProfileForToken = useCallback(
    async (options?: RefreshProfileRoleOptions): Promise<ProfileRoleResponse | null> => {
      const silent = options?.silent === true;
      const t = tokenRef.current?.trim();
      if (!t) {
        setProfileRole(null);
        return null;
      }
      if (!silent) {
        setProfileRoleLoading(true);
      }
      try {
        const data = await fetchProfileRole();
        await persistProfileRolePayload(data);

        setProfileRole(prev => {
          if (!data) {
            return data;
          }
          const prevCompanies = companiesFromProfileRole(prev?.data?.companies ?? {});
          const nextCompanies = companiesFromProfileRole(data.data?.companies ?? {});
          if (silent && prev != null && companiesListEqual(prevCompanies, nextCompanies)) {
            const nextUser = data.data?.user;
            if (nextUser == null || prev.data?.user === nextUser) {
              return prev;
            }
            return {
              ...prev,
              data: {
                ...prev.data,
                user: nextUser,
              },
            };
          }
          return data;
        });

        return data;
      } catch {
        if (!silent) {
          setProfileRole(null);
        }
        return null;
      } finally {
        if (!silent) {
          setProfileRoleLoading(false);
        }
      }
    },
    [persistProfileRolePayload],
  );

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
    setProfileRoleUser(null);
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

    Promise.all([
      loadAuthSession(),
      loadSelectedCompany(),
      loadCachedUserProfile(),
      loadProfileRoleUser(),
    ]).then(([s, company, cached, storedUser]) => {
        if (cancelled) {
          return;
        }
        tokenRef.current = s.token;
        setToken(s.token);
        setEmail(s.email);
        setName(s.name);
        setSelectedCompany(company);
        const cachedFromDisk =
          cached ?? (storedUser ? cachedProfileFromProfileRoleResponse({ data: { user: storedUser } }) : null);
        setCachedUserProfile(cachedFromDisk);
        setProfileRoleUser(storedUser);
        if (cachedFromDisk) {
          if (!s.name?.trim() && cachedFromDisk.name.trim()) {
            setName(cachedFromDisk.name.trim());
          }
          if (!s.email?.trim() && cachedFromDisk.email.trim()) {
            setEmail(cachedFromDisk.email.trim());
          }
        }
        setHydrated(true);

        if (s.token?.trim()) {
          loadProfileForToken().catch(() => {});
        }
      });

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

  const refreshProfileRole = useCallback(
    async (options?: RefreshProfileRoleOptions) => loadProfileForToken(options),
    [loadProfileForToken],
  );

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

  const applySessionFromProfileUpdate = useCallback(async (user: Partial<UserProfile>) => {
    const displayPatch: { name?: string | null; email?: string | null } = {};
    if (user.name !== undefined) {
      displayPatch.name = user.name;
    }
    if (user.email !== undefined) {
      displayPatch.email = user.email;
    }
    if (Object.keys(displayPatch).length > 0) {
      await updateStoredAuthDisplayFields(displayPatch);
    }
    if (user.name !== undefined) {
      setName(user.name?.trim() ? user.name.trim() : null);
    }
    if (user.email !== undefined) {
      setEmail(user.email?.trim() ? user.email.trim() : null);
    }
    setProfileRole(prev => {
      if (!prev?.data) {
        return prev;
      }
      const prevUser =
        prev.data.user && typeof prev.data.user === 'object'
          ? (prev.data.user as Record<string, unknown>)
          : {};
      const mergedUser = { ...prevUser, ...user };
      void saveProfileRoleUser(mergedUser);
      setProfileRoleUser(mergedUser as ProfileRoleUser);
      return {
        ...prev,
        data: {
          ...prev.data,
          user: mergedUser,
        },
      };
    });
    setCachedUserProfile(prev => {
      const next = mergeUserProfileIntoCachedProfile(user, prev);
      void saveCachedUserProfile(next);
      applyProfileRoleUserToSession(next);
      return next;
    });
  }, [applyProfileRoleUserToSession]);

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
      profileRoleUser,
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
      profileRoleUser,
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

import type { CurrentUser, LoginRequest, RegisterRequest } from '@miscellary/shared';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { apiFetch, refreshAccessToken, saveRefreshToken, setAccessToken } from './api';

interface Session {
  user: CurrentUser;
  access: string;
  refresh: string;
}

interface AuthContextValue {
  user: CurrentUser | null;
  loading: boolean;
  login: (data: LoginRequest) => Promise<void>;
  register: (data: RegisterRequest) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  const applySession = useCallback(async (session: Session) => {
    setAccessToken(session.access);
    await saveRefreshToken(session.refresh);
    setUser(session.user);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        if (await refreshAccessToken()) setUser(await apiFetch<CurrentUser>('/api/v1/auth/me/'));
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const login = useCallback(
    async (data: LoginRequest) =>
      applySession(
        await apiFetch<Session>('/api/v1/auth/login/', { method: 'POST', body: data, auth: false }),
      ),
    [applySession],
  );
  const register = useCallback(
    async (data: RegisterRequest) =>
      applySession(
        await apiFetch<Session>('/api/v1/auth/register/', {
          method: 'POST',
          body: data,
          auth: false,
        }),
      ),
    [applySession],
  );
  const logout = useCallback(async () => {
    try {
      await apiFetch<void>('/api/v1/auth/logout/', { method: 'POST' });
    } finally {
      setAccessToken(null);
      await saveRefreshToken(null);
      setUser(null);
    }
  }, []);
  const refreshUser = useCallback(
    async () => setUser(await apiFetch<CurrentUser>('/api/v1/auth/me/')),
    [],
  );

  const value = useMemo(
    () => ({ user, loading, login, register, logout, refreshUser }),
    [user, loading, login, register, logout, refreshUser],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

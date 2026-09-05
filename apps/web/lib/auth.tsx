'use client';

import type { CurrentUser, LoginRequest, RegisterRequest } from '@miscellary/shared';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { apiFetch, refreshAccessToken, setAccessToken } from './api';

interface AuthSession {
  user: CurrentUser;
  access: string;
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

  const applySession = useCallback((session: AuthSession) => {
    setAccessToken(session.access);
    setUser(session.user);
  }, []);

  const refreshUser = useCallback(async () => {
    const me = await apiFetch<CurrentUser>('/api/v1/auth/me/');
    setUser(me);
  }, []);

  // On first load, trade the HttpOnly refresh cookie for an access token.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!(await refreshAccessToken())) throw new Error('no session');
        const me = await apiFetch<CurrentUser>('/api/v1/auth/me/');
        if (!cancelled) setUser(me);
      } catch {
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(
    async (data: LoginRequest) => {
      applySession(
        await apiFetch<AuthSession>('/api/v1/auth/login/', {
          method: 'POST',
          body: data,
          auth: false,
        }),
      );
    },
    [applySession],
  );

  const register = useCallback(
    async (data: RegisterRequest) => {
      applySession(
        await apiFetch<AuthSession>('/api/v1/auth/register/', {
          method: 'POST',
          body: data,
          auth: false,
        }),
      );
    },
    [applySession],
  );

  const logout = useCallback(async () => {
    try {
      await apiFetch<void>('/api/v1/auth/logout/', { method: 'POST' });
    } finally {
      setAccessToken(null);
      setUser(null);
    }
  }, []);

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

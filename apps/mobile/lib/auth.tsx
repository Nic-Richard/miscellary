import type {
  CurrentUser,
  GoogleProof,
  GoogleSignup,
  LoginRequest,
  RegisterRequest,
} from '@miscellary/shared';
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
  googleLogin: (data: GoogleProof) => Promise<void>;
  googleRegister: (data: GoogleSignup) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  updateTheme: (theme: string) => Promise<void>;
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
  const googleLogin = useCallback(
    async (body: GoogleProof) => {
      await applySession(
        await apiFetch<Session>('/api/v1/auth/google/login/', {
          method: 'POST',
          body,
          auth: false,
        }),
      );
    },
    [applySession],
  );
  const googleRegister = useCallback(
    async (body: GoogleSignup) => {
      await applySession(
        await apiFetch<Session>('/api/v1/auth/google/register/', {
          method: 'POST',
          body,
          auth: false,
        }),
      );
    },
    [applySession],
  );

  const updateTheme = useCallback(async (theme: string) => {
    const updated = await apiFetch<CurrentUser & { theme: string }>('/api/v1/auth/preferences/', {
      method: 'PATCH',
      body: { theme },
    });
    setUser((current) =>
      current?.id === updated.id ? { ...current, theme: updated.theme } : current,
    );
  }, []);

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
    () => ({
      user,
      loading,
      login,
      register,
      googleLogin,
      googleRegister,
      logout,
      refreshUser,
      updateTheme,
    }),
    [user, loading, login, register, googleLogin, googleRegister, logout, refreshUser, updateTheme],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

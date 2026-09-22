import { Redirect, usePathname } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { loginRoute } from '@/lib/returnTo';
import { Loading } from './ui';
import type { ReactNode } from 'react';

export default function LoginGate({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  if (loading) return <Loading />;
  if (!user) return <Redirect href={loginRoute(pathname)} />;
  return <>{children}</>;
}

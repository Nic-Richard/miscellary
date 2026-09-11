import { Link, usePathname } from 'expo-router';
import { Text } from 'react-native';
import { useAuth } from '@/lib/auth';
import { loginRoute } from '@/lib/returnTo';
import { colors } from '@/lib/theme';
import { Loading, Muted, Screen } from './ui';
import type { ReactNode } from 'react';

export default function LoginGate({ children, message }: { children: ReactNode; message: string }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  if (loading) return <Loading />;
  if (!user) {
    const back = loginRoute(pathname);
    const query = back.includes('?') ? `?${back.split('?')[1]}` : '';
    return (
      <Screen style={{ paddingTop: 40, gap: 10 }}>
        <Muted>{message}</Muted>
        <Link href={`/(auth)/login${query}`}>
          <Text style={{ color: colors.accent, fontSize: 16 }}>Log in</Text>
        </Link>
        <Link href={`/(auth)/register${query}`}>
          <Text style={{ color: colors.accent, fontSize: 16 }}>Sign up</Text>
        </Link>
      </Screen>
    );
  }
  return <>{children}</>;
}

import { Link } from 'expo-router';
import { Text } from 'react-native';
import { useAuth } from '@/lib/auth';
import { colors } from '@/lib/theme';
import { Loading, Muted, Screen } from './ui';
import type { ReactNode } from 'react';

export default function LoginGate({ children, message }: { children: ReactNode; message: string }) {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  if (!user)
    return (
      <Screen style={{ paddingTop: 40, gap: 10 }}>
        <Muted>{message}</Muted>
        <Link href="/(auth)/login">
          <Text style={{ color: colors.accent, fontSize: 16 }}>Log in</Text>
        </Link>
        <Link href="/(auth)/register">
          <Text style={{ color: colors.accent, fontSize: 16 }}>Sign up</Text>
        </Link>
      </Screen>
    );
  return <>{children}</>;
}

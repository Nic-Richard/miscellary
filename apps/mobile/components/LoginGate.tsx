import { router } from 'expo-router';
import { StyleSheet } from 'react-native';
import { useAuth } from '@/lib/auth';
import { Button, Loading, Muted, Screen } from './ui';
import type { ReactNode } from 'react';

export default function LoginGate({ children, note }: { children: ReactNode; note?: string }) {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  if (!user)
    return (
      <Screen style={styles.panel}>
        <Muted style={styles.note}>{note ?? 'Log in to continue.'}</Muted>
        <Button title="Log in" onPress={() => router.push('/login')} />
        <Button title="Sign up" kind="secondary" onPress={() => router.push('/register')} />
      </Screen>
    );
  return <>{children}</>;
}

const styles = StyleSheet.create({
  panel: { gap: 12, padding: 20 },
  note: { fontSize: 17, lineHeight: 24, marginBottom: 6 },
});

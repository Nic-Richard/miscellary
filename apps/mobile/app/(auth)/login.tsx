import { Link, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { useAuth } from '@/lib/auth';
import GoogleAuth from '@/components/GoogleAuth';
import { internalRoute, RETURN_PARAM } from '@/lib/returnTo';
import { colors } from '@/lib/theme';
import { Button, ErrorText, Input, Screen, PasswordInput } from '@/components/ui';

export default function LoginScreen() {
  const { login } = useAuth();
  const params = useLocalSearchParams();
  const next = internalRoute(params[RETURN_PARAM]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await login({ email, password });
      if (next) router.replace(next);
      else if (router.canGoBack()) router.back();
      else router.replace('/(tabs)');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Login failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen style={{ gap: 12, paddingTop: 32 }}>
      <GoogleAuth
        onDone={() => {
          if (next) router.replace(next);
          else if (router.canGoBack()) router.back();
          else router.replace('/(tabs)');
        }}
      />
      <ErrorText>{error}</ErrorText>
      <Input
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <PasswordInput placeholder="Password" value={password} onChangeText={setPassword} />
      <Button
        title={busy ? 'Logging in…' : 'Log in'}
        disabled={busy}
        onPress={() => void submit()}
      />
      <View style={{ alignItems: 'center', marginTop: 8 }}>
        <Link href="/(auth)/forgot-password">
          <Text style={{ color: colors.accent }}>Forgot your password?</Text>
        </Link>
      </View>
      <View style={{ alignItems: 'center' }}>
        <Link
          href={
            next
              ? `/(auth)/register?${RETURN_PARAM}=${encodeURIComponent(next)}`
              : '/(auth)/register'
          }
        >
          <Text style={{ color: colors.accent }}>No account? Sign up</Text>
        </Link>
      </View>
    </Screen>
  );
}

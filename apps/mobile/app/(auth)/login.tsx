import { Link, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { useAuth } from '@/lib/auth';
import GoogleAuth from '@/components/GoogleAuth';
import { internalRoute, RETURN_PARAM } from '@/lib/returnTo';
import AuthCard, { useAuthStyles } from '@/components/AuthCard';
import { Button, ErrorText, Input, PasswordInput } from '@/components/ui';

export default function LoginScreen() {
  const auth = useAuthStyles();
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
    <AuthCard title="Log in" subtitle="Welcome back to your collection.">
      <GoogleAuth
        onDone={() => {
          if (next) router.replace(next);
          else if (router.canGoBack()) router.back();
          else router.replace('/(tabs)');
        }}
      />
      <ErrorText>{error}</ErrorText>
      <Input
        accessibilityLabel="Email"
        placeholder="Email"
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <PasswordInput
        accessibilityLabel="Password"
        placeholder="Password"
        autoComplete="current-password"
        value={password}
        onChangeText={setPassword}
      />
      <Button
        title={busy ? 'Logging in…' : 'Log in'}
        disabled={busy}
        onPress={() => void submit()}
      />
      <View style={auth.footer}>
        <Link href="/(auth)/forgot-password">
          <Text style={auth.link}>Forgot your password?</Text>
        </Link>
        <Link
          href={
            next
              ? `/(auth)/register?${RETURN_PARAM}=${encodeURIComponent(next)}`
              : '/(auth)/register'
          }
        >
          <Text style={auth.link}>No account? Sign up</Text>
        </Link>
      </View>
    </AuthCard>
  );
}

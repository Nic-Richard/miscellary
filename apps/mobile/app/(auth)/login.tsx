import { Link, router } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { useAuth } from '@/lib/auth';
import { colors } from '@/lib/theme';
import { Button, ErrorText, Input, Screen, Title } from '@/components/ui';

export default function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await login({ email, password });
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Login failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen style={{ gap: 12, paddingTop: 32 }}>
      <Title>Log in</Title>
      <ErrorText>{error}</ErrorText>
      <Input
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <Input placeholder="Password" secureTextEntry value={password} onChangeText={setPassword} />
      <Button
        title={busy ? 'Logging in…' : 'Log in'}
        disabled={busy}
        onPress={() => void submit()}
      />
      <View style={{ alignItems: 'center', marginTop: 8 }}>
        <Link href="/(auth)/register">
          <Text style={{ color: colors.accent }}>No account? Sign up</Text>
        </Link>
      </View>
    </Screen>
  );
}

import { router } from 'expo-router';
import { useState } from 'react';
import { Text } from 'react-native';
import { ApiRequestError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { colors } from '@/lib/theme';
import { Button, ErrorText, Input, Screen, Title } from '@/components/ui';

export default function RegisterScreen() {
  const { register } = useAuth();
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string[]>>({});
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    setFields({});
    try {
      await register({ email, username, password });
      router.replace('/(tabs)');
    } catch (e) {
      if (e instanceof ApiRequestError) {
        setError(e.message);
        setFields(e.fields);
      } else setError('Sign up failed.');
    } finally {
      setBusy(false);
    }
  }

  const fieldError = (name: string) =>
    fields[name]?.map((m) => (
      <Text key={m} style={{ color: colors.danger, fontSize: 12 }}>
        {m}
      </Text>
    ));

  return (
    <Screen style={{ gap: 12, paddingTop: 32 }}>
      <Title>Create your account</Title>
      <ErrorText>{error}</ErrorText>
      <Input
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      {fieldError('email')}
      <Input
        placeholder="Username"
        autoCapitalize="none"
        value={username}
        onChangeText={setUsername}
      />
      {fieldError('username')}
      <Input placeholder="Password" secureTextEntry value={password} onChangeText={setPassword} />
      {fieldError('password')}
      <Button
        title={busy ? 'Creating…' : 'Sign up'}
        disabled={busy}
        onPress={() => void submit()}
      />
    </Screen>
  );
}

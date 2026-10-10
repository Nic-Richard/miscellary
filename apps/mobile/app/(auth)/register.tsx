import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Linking, Text, View } from 'react-native';
import { ApiRequestError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import GoogleAuth from '@/components/GoogleAuth';
import { internalRoute, RETURN_PARAM } from '@/lib/returnTo';
import AuthCard, { useAuthStyles } from '@/components/AuthCard';
import { Button, ErrorText, Input, PasswordInput } from '@/components/ui';

const SITE = 'https://miscellary.com';

export default function RegisterScreen() {
  const auth = useAuthStyles();
  const { register } = useAuth();
  const params = useLocalSearchParams();
  const next = internalRoute(params[RETURN_PARAM]);
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
      router.replace(next ?? '/(tabs)/packs');
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
      <Text key={m} style={auth.fieldError}>
        {m}
      </Text>
    ));

  return (
    <AuthCard title="Create your account" subtitle="Collect, trade and make your own sets.">
      <GoogleAuth onDone={() => router.replace(next ?? '/(tabs)/packs')} />
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
      {fieldError('email')}
      <Input
        accessibilityLabel="Username"
        placeholder="Username"
        autoCapitalize="none"
        autoComplete="username-new"
        value={username}
        onChangeText={setUsername}
      />
      {fieldError('username')}
      <PasswordInput
        accessibilityLabel="Password"
        placeholder="Password"
        autoComplete="new-password"
        value={password}
        onChangeText={setPassword}
      />
      {fieldError('password')}
      <Text style={auth.note}>At least 8 characters.</Text>
      <Text style={auth.note}>
        By signing up you agree to the{' '}
        <Text style={auth.link} onPress={() => void Linking.openURL(`${SITE}/terms`)}>
          terms
        </Text>{' '}
        and{' '}
        <Text style={auth.link} onPress={() => void Linking.openURL(`${SITE}/privacy`)}>
          privacy policy
        </Text>
        .
      </Text>
      <Button
        title={busy ? 'Creating…' : 'Sign up'}
        disabled={busy}
        onPress={() => void submit()}
      />
      <View style={auth.footer}>
        <Text
          accessibilityRole="link"
          style={auth.link}
          onPress={() =>
            router.replace(next ? `/login?${RETURN_PARAM}=${encodeURIComponent(next)}` : '/login')
          }
        >
          Already have an account? Log in
        </Text>
      </View>
    </AuthCard>
  );
}

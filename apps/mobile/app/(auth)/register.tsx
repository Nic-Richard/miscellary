import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Linking, Switch, Text, View } from 'react-native';
import { ApiRequestError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import GoogleAuth from '@/components/GoogleAuth';
import { internalRoute, RETURN_PARAM } from '@/lib/returnTo';
import AuthCard, { useAuthStyles } from '@/components/AuthCard';
import { useColors } from '@/lib/theme';
import { Button, ErrorText, Input, PasswordInput } from '@/components/ui';

const SITE = 'https://miscellary.com';

export default function RegisterScreen() {
  const auth = useAuthStyles();
  const colors = useColors();
  const { register } = useAuth();
  const params = useLocalSearchParams();
  const next = internalRoute(params[RETURN_PARAM]);
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string[]>>({});
  const [busy, setBusy] = useState(false);
  const [accepted, setAccepted] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    setFields({});
    try {
      await register({ email, username, password, terms_accepted: accepted });
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
      <View style={auth.agree}>
        <Switch
          accessibilityLabel="I agree to the terms and privacy policy"
          value={accepted}
          onValueChange={setAccepted}
          trackColor={{ true: colors.accent, false: colors.bdr2 }}
          thumbColor={colors.sur}
        />
        <Text style={[auth.note, { flex: 1 }]}>
          I agree to the{' '}
          <Text style={auth.link} onPress={() => void Linking.openURL(`${SITE}/terms`)}>
            terms
          </Text>
          , including the community rules, and the{' '}
          <Text style={auth.link} onPress={() => void Linking.openURL(`${SITE}/privacy`)}>
            privacy policy
          </Text>
          .
        </Text>
      </View>
      <Button
        title={busy ? 'Creating…' : 'Sign up'}
        disabled={busy || !accepted}
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

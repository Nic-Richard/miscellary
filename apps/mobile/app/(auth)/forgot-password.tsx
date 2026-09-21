import { Link } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { Button, ErrorText, Input, Muted, Screen, Title } from '@/components/ui';
import { requestPasswordReset } from '@/lib/endpoints';
import { colors } from '@/lib/theme';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await requestPasswordReset(email);
      setSent(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not send that email.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen style={{ gap: 12, paddingTop: 32 }}>
      <Title>Reset password</Title>
      <ErrorText>{error}</ErrorText>
      {sent ? (
        <Muted>If that address has an account, a reset link is on its way.</Muted>
      ) : (
        <>
          <Input
            placeholder="Email"
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            value={email}
            onChangeText={setEmail}
          />
          <Button
            title={busy ? 'Sending…' : 'Send reset link'}
            disabled={busy || !email.trim()}
            onPress={() => void submit()}
          />
        </>
      )}
      <View style={{ alignItems: 'center', marginTop: 8 }}>
        <Link href="/(auth)/login">
          <Text style={{ color: colors.accent }}>Back to login</Text>
        </Link>
      </View>
    </Screen>
  );
}

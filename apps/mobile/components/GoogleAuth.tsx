import type { GoogleProof } from '@miscellary/shared';
import { useState } from 'react';
import { Linking, Switch, Text, View } from 'react-native';
import { ApiRequestError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { googleAvailable, googleProof } from '@/lib/google';
import { useColors } from '@/lib/theme';
import { Button, ErrorText, Input, Muted } from './ui';
import { OrDivider } from './AuthCard';
import GoogleButton from './GoogleButton';

export default function GoogleAuth({ onDone }: { onDone: () => void }) {
  const colors = useColors();
  const { googleLogin, googleRegister } = useAuth();
  const [proof, setProof] = useState<GoogleProof | null>(null);
  const [username, setUsername] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function login() {
    setBusy(true);
    setError(null);
    try {
      const value = await googleProof();
      try {
        await googleLogin(value);
        onDone();
      } catch (err) {
        if (err instanceof ApiRequestError && err.code === 'google_signup_required')
          setProof(value);
        else throw err;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google sign-in failed.');
    } finally {
      setBusy(false);
    }
  }

  async function signup() {
    if (!proof || busy) return;
    setBusy(true);
    setError(null);
    try {
      await googleRegister({ ...proof, username, terms_accepted: accepted });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign up failed.');
    } finally {
      setBusy(false);
    }
  }

  if (!googleAvailable) return null;
  return (
    <View style={{ gap: 12 }}>
      {proof ? (
        <>
          <Muted>Choose a username to finish creating your account.</Muted>
          <Input
            accessibilityLabel="Username for Google signup"
            placeholder="Username"
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={20}
            value={username}
            onChangeText={setUsername}
          />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Switch
              accessibilityLabel="Agree to the terms and privacy policy"
              value={accepted}
              onValueChange={setAccepted}
            />
            <Text style={{ flex: 1, color: colors.text }}>
              I agree to the{' '}
              <Text
                style={{ color: colors.accentInk }}
                onPress={() => void Linking.openURL('https://miscellary.com/terms')}
              >
                terms
              </Text>{' '}
              and{' '}
              <Text
                style={{ color: colors.accentInk }}
                onPress={() => void Linking.openURL('https://miscellary.com/privacy')}
              >
                privacy policy
              </Text>
              .
            </Text>
          </View>
          <Button
            title={busy ? 'Creating…' : 'Create account'}
            disabled={busy || !accepted || !username.trim()}
            onPress={() => void signup()}
          />
          <Button
            title="Choose another sign-in method"
            kind="secondary"
            disabled={busy}
            onPress={() => {
              setProof(null);
              setError(null);
            }}
          />
        </>
      ) : (
        <>
          <GoogleButton busy={busy} onPress={login} />
          <OrDivider label="or use your email" />
        </>
      )}
      <ErrorText>{error}</ErrorText>
    </View>
  );
}

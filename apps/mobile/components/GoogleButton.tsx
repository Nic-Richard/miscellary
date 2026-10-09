import { useEffect, useState } from 'react';
import type { ComponentType } from 'react';
import type { GoogleSignInButtonProps } from 'react-native-nitro-google-signin';
import { googleAvailable } from '@/lib/google';
import { ErrorText, Muted } from './ui';

export default function GoogleButton({
  busy,
  disabled,
  onPress,
}: {
  busy: boolean;
  disabled?: boolean;
  onPress: () => Promise<void>;
}) {
  const [Button, setButton] = useState<ComponentType<GoogleSignInButtonProps> | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!googleAvailable) return;
    let cancelled = false;
    void import('react-native-nitro-google-signin')
      .then((sdk) => {
        if (!cancelled) setButton(() => sdk.GoogleSignInButton);
      })
      .catch(() => {
        if (!cancelled)
          setError('Google sign-in needs the updated app build. Email and password still work.');
      });
    return () => {
      cancelled = true;
    };
  }, []);
  if (!googleAvailable) return null;
  if (error) return <ErrorText>{error}</ErrorText>;
  if (!Button) return <Muted>Loading Google sign-in…</Muted>;
  return (
    <Button
      colorScheme="light"
      size="wide"
      signInBehavior="none"
      loading={busy}
      disabled={busy || Boolean(disabled)}
      onPress={onPress}
      accessibilityLabel="Continue with Google"
      style={{ alignSelf: 'center' }}
    />
  );
}

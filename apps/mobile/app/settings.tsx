import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import LoginGate from '@/components/LoginGate';
import GoogleButton from '@/components/GoogleButton';
import ThemeSelector from '@/components/ThemeSelector';
import { Button, ErrorText, Input, Muted, PasswordInput } from '@/components/ui';
import { ApiRequestError, apiFetch } from '@/lib/api';
import { confirmGoogle, googleAvailable, googleProof } from '@/lib/google';
import { useAuth } from '@/lib/auth';
import {
  changePassword,
  changeUsername,
  deleteAccount,
  resendVerificationEmail,
} from '@/lib/endpoints';
import { fonts, useColors, createThemedStyles } from '@/lib/theme';

function fieldError(error: unknown, name: string): string {
  if (error instanceof ApiRequestError) return error.fields[name]?.[0] ?? error.message;
  return error instanceof Error ? error.message : 'Something went wrong.';
}

function Card({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  const styles = useStyles();
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      {note ? <Muted style={styles.note}>{note}</Muted> : null}
      {children}
    </View>
  );
}

function CloseAccount() {
  const styles = useStyles();
  const { user, logout } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function close() {
    setBusy(true);
    setError(null);
    try {
      await deleteAccount(
        password,
        user?.has_password === false ? await confirmGoogle('delete') : undefined,
      );
      await logout();
      router.replace('/');
    } catch (e) {
      setError(fieldError(e, 'current_password'));
      setBusy(false);
    }
  }

  return (
    <Card
      title="Close account"
      note="Your cards, drafts, follows, likes and open trades go. Published sets stay, so the people who collected them keep their cards; those sets and your comments show as a deleted user."
    >
      {open ? (
        <>
          {user?.has_password !== false && (
            <PasswordInput
              accessibilityLabel="Current password"
              placeholder="Current password"
              value={password}
              onChangeText={setPassword}
            />
          )}
          <ErrorText>{error}</ErrorText>
          <Text style={styles.warning}>This cannot be undone.</Text>
          <Button
            title={busy ? 'Closing…' : 'Close my account'}
            kind="danger"
            disabled={busy || (user?.has_password !== false && !password)}
            onPress={() => void close()}
          />
          <Button
            title="Keep it"
            kind="secondary"
            disabled={busy}
            onPress={() => {
              setOpen(false);
              setPassword('');
              setError(null);
            }}
          />
        </>
      ) : (
        <Button title="Close account…" kind="danger" onPress={() => setOpen(true)} />
      )}
    </Card>
  );
}

function Account() {
  const colors = useColors();
  const styles = useStyles();
  const { user, refreshUser } = useAuth();
  const [username, setUsername] = useState(user?.profile.username ?? '');
  const [usernamePassword, setUsernamePassword] = useState('');
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [usernameDone, setUsernameDone] = useState(false);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordDone, setPasswordDone] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [busy, setBusy] = useState(false);

  useFocusEffect(
    useCallback(() => {
      void refreshUser();
    }, [refreshUser]),
  );

  if (!user) return null;

  const locked = user.username_change_available_at;
  const readyOn = locked ? new Date(locked).toLocaleDateString() : null;

  async function saveUsername() {
    setBusy(true);
    setUsernameError(null);
    setUsernameDone(false);
    try {
      await changeUsername(
        username.trim().toLowerCase(),
        usernamePassword,
        user?.has_password === false ? await confirmGoogle('username') : undefined,
      );
      await refreshUser();
      setUsernamePassword('');
      setUsernameDone(true);
    } catch (e) {
      setUsernameError(fieldError(e, 'username'));
    } finally {
      setBusy(false);
    }
  }

  async function savePassword() {
    setBusy(true);
    setPasswordError(null);
    setPasswordDone(false);
    try {
      await changePassword(
        current,
        next,
        user?.has_password === false ? await confirmGoogle('password') : undefined,
      );
      await refreshUser();
      setCurrent('');
      setNext('');
      setPasswordDone(true);
    } catch (e) {
      setPasswordError(fieldError(e, 'new_password'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={styles.content}>
      <Card
        title="Appearance"
        note="Your colour theme is saved to your account, on web and mobile."
      >
        <ThemeSelector />
      </Card>
      <Card
        title="Username"
        note={
          readyOn
            ? `You can change this again on ${readyOn}. Until then your previous name stays reserved, so nobody else can stand where an old link points.`
            : 'Your profile lives at this address. Changing it keeps your old name reserved for you, and you can change again after 30 days.'
        }
      >
        <Input
          accessibilityLabel="Username"
          value={username}
          onChangeText={setUsername}
          editable={!locked && !busy}
          maxLength={20}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {locked || user.has_password === false ? null : (
          <PasswordInput
            accessibilityLabel="Current password"
            placeholder="Current password"
            value={usernamePassword}
            onChangeText={setUsernamePassword}
          />
        )}
        <ErrorText>{usernameError}</ErrorText>
        {usernameDone ? <Text style={styles.done}>Your username has been changed.</Text> : null}
        <Button
          title="Change username"
          kind="secondary"
          disabled={
            Boolean(locked) ||
            busy ||
            (user.has_password !== false && !usernamePassword) ||
            username.trim().toLowerCase() === user.profile.username
          }
          onPress={() => void saveUsername()}
        />
      </Card>

      <Card
        title="Email"
        note="Used to log in and to reset your password. It is never shown on your profile."
      >
        <Text style={styles.value}>{user.email}</Text>
        <Text style={user.email_verified ? styles.verified : styles.unverified}>
          {user.email_verified ? 'Verified' : 'Unverified'}
        </Text>
        {user.email_verified ? null : (
          <>
            {emailSent ? <Text style={styles.done}>Verification email sent.</Text> : null}
            <Button
              title="Send the link again"
              kind="secondary"
              disabled={busy || emailSent}
              onPress={() => void resendVerificationEmail().then(() => setEmailSent(true))}
            />
          </>
        )}
      </Card>

      <Card title="Password" note="Changing it signs you out on every other device and browser.">
        {user.has_password !== false && (
          <PasswordInput
            accessibilityLabel="Current password"
            placeholder="Current password"
            value={current}
            onChangeText={setCurrent}
          />
        )}
        <PasswordInput
          accessibilityLabel="New password"
          placeholder="New password"
          value={next}
          onChangeText={setNext}
        />
        <ErrorText>{passwordError}</ErrorText>
        {passwordDone ? <Text style={styles.done}>Your password has been changed.</Text> : null}
        <Button
          title={user.has_password === false ? 'Set password' : 'Change password'}
          kind="secondary"
          disabled={busy || (user.has_password !== false && !current) || !next}
          onPress={() => void savePassword()}
        />
      </Card>

      <GoogleConnection />
      <CloseAccount />
    </ScrollView>
  );
}

function GoogleConnection() {
  const { user, refreshUser } = useAuth();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (!googleAvailable || !user) return null;

  async function save() {
    setBusy(true);
    setError(null);
    try {
      if (user?.google_connected) {
        await apiFetch('/api/v1/auth/google/disconnect/', {
          method: 'POST',
          body: { current_password: password },
        });
      } else {
        const proof = await googleProof('link');
        await apiFetch('/api/v1/auth/google/link/', {
          method: 'POST',
          body: { ...proof, current_password: password },
        });
      }
      await refreshUser();
      setOpen(false);
      setPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update Google sign-in.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card
      title="Google"
      note={
        user.google_connected
          ? 'Google is connected. Set a password before disconnecting it.'
          : 'Connect Google without changing your email or collection.'
      }
    >
      {!user.email_verified ? (
        <Muted>Verify your email before connecting Google.</Muted>
      ) : open ? (
        <>
          <PasswordInput
            accessibilityLabel="Current password"
            placeholder="Current password"
            value={password}
            onChangeText={setPassword}
          />
          <ErrorText>{error}</ErrorText>
          {user.google_connected ? (
            <Button
              title="Disconnect Google"
              kind="secondary"
              disabled={busy || !password}
              onPress={() => void save()}
            />
          ) : (
            <GoogleButton busy={busy} disabled={!password} onPress={save} />
          )}
          <Button
            title="Cancel"
            kind="secondary"
            disabled={busy}
            onPress={() => {
              setOpen(false);
              setPassword('');
              setError(null);
            }}
          />
        </>
      ) : (
        <Button
          title={user.google_connected ? 'Disconnect Google' : 'Connect Google'}
          kind="secondary"
          disabled={user.has_password === false}
          onPress={() => setOpen(true)}
        />
      )}
    </Card>
  );
}

export default function SettingsScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Account' }} />
      <LoginGate>
        <Account />
      </LoginGate>
    </>
  );
}

const useStyles = createThemedStyles((colors) => ({
  content: { padding: 16, paddingBottom: 40, gap: 14 },
  card: {
    gap: 10,
    padding: 16,
    backgroundColor: colors.sur,
    borderWidth: 1,
    borderColor: colors.bdr,
    borderRadius: 8,
  },
  cardTitle: { color: colors.text, fontFamily: fonts.display, fontSize: 24 },
  note: { fontSize: 14, lineHeight: 19 },
  value: { color: colors.text, fontFamily: fonts.body, fontSize: 16 },
  verified: { color: colors.accent, fontFamily: fonts.medium, fontSize: 15 },
  unverified: { color: colors.gold, fontFamily: fonts.medium, fontSize: 15 },
  done: { color: colors.accent, fontFamily: fonts.body, fontSize: 14 },
  warning: { color: colors.danger, fontFamily: fonts.body, fontSize: 14 },
}));

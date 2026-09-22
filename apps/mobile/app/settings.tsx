import { Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import LoginGate from '@/components/LoginGate';
import { Button, ErrorText, Input, Muted } from '@/components/ui';
import { ApiRequestError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { changePassword, changeUsername, resendVerificationEmail } from '@/lib/endpoints';
import { colors, fonts } from '@/lib/theme';

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
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      {note ? <Muted style={styles.note}>{note}</Muted> : null}
      {children}
    </View>
  );
}

function Account() {
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
      await changeUsername(username.trim().toLowerCase(), usernamePassword);
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
      await changePassword(current, next);
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
        {locked ? null : (
          <Input
            accessibilityLabel="Current password"
            placeholder="Current password"
            value={usernamePassword}
            onChangeText={setUsernamePassword}
            secureTextEntry
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
            !usernamePassword ||
            username.trim().toLowerCase() === user.profile.username
          }
          onPress={() => void saveUsername()}
        />
      </Card>

      <Card
        title="Email"
        note="Used to sign in and to reset your password. It is never shown on your profile."
      >
        <Text style={styles.value}>{user.email}</Text>
        <Text style={user.email_verified ? styles.verified : styles.unverified}>
          {user.email_verified ? 'VERIFIED' : 'UNVERIFIED'}
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

      <Card title="Password">
        <Input
          accessibilityLabel="Current password"
          placeholder="Current password"
          value={current}
          onChangeText={setCurrent}
          secureTextEntry
        />
        <Input
          accessibilityLabel="New password"
          placeholder="New password"
          value={next}
          onChangeText={setNext}
          secureTextEntry
        />
        <ErrorText>{passwordError}</ErrorText>
        {passwordDone ? <Text style={styles.done}>Your password has been changed.</Text> : null}
        <Button
          title="Change password"
          kind="secondary"
          disabled={busy || !current || !next}
          onPress={() => void savePassword()}
        />
      </Card>
    </ScrollView>
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

const styles = StyleSheet.create({
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
  note: { fontSize: 13, lineHeight: 19 },
  value: { color: colors.text, fontFamily: fonts.body, fontSize: 16 },
  verified: { color: colors.accent, fontFamily: fonts.medium, fontSize: 11, letterSpacing: 1.3 },
  unverified: { color: colors.gold, fontFamily: fonts.medium, fontSize: 11, letterSpacing: 1.3 },
  done: { color: colors.accent, fontFamily: fonts.body, fontSize: 14 },
});

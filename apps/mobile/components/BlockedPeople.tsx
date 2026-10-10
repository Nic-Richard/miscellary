import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { Alert, Pressable, Text, View } from 'react-native';
import type { Creator } from '@miscellary/shared';
import { BLOCK_COPY } from '@miscellary/shared';
import { listBlocked, setBlocked } from '@/lib/endpoints';
import { useAuth } from '@/lib/auth';
import { createThemedStyles, fonts } from '@/lib/theme';
import Avatar from './Avatar';
import { Button, ErrorText, Muted } from './ui';

export function confirmBlock(username: string, onBlock: () => void) {
  Alert.alert(`Block @${username}?`, BLOCK_COPY.effects, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Block', style: 'destructive', onPress: onBlock },
  ]);
}

export default function BlockedPeople() {
  const styles = useStyles();
  const { user } = useAuth();
  const [people, setPeople] = useState<Creator[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setError(null);
    void listBlocked(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setPeople(data);
      })
      .catch((err: unknown) => {
        if (!controller.signal.aborted)
          setError(err instanceof Error ? err.message : 'Could not load blocked collectors.');
      });
    return () => controller.abort();
  }, [user?.id, version]);

  async function unblock(username: string) {
    setBusy(username);
    setError(null);
    try {
      await setBlocked(username, false);
      setPeople((current) => current?.filter((person) => person.username !== username) ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not unblock that collector.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <View style={styles.list}>
      <Muted>{BLOCK_COPY.explain}</Muted>
      <ErrorText>{error}</ErrorText>
      {error && (
        <Button kind="secondary" title="Try again" onPress={() => setVersion((v) => v + 1)} />
      )}
      {!people && !error && <Muted>Loading…</Muted>}
      {people && !people.length && <Muted>{BLOCK_COPY.empty}</Muted>}
      {people?.map((person) => (
        <View key={person.username} style={styles.row}>
          <Pressable
            accessibilityRole="link"
            style={styles.who}
            onPress={() => router.push(`/users/${person.username}`)}
          >
            <Avatar person={person} size={36} />
            <View style={{ flex: 1 }}>
              <Text style={styles.name} numberOfLines={1}>
                {person.display_name || person.username}
              </Text>
              <Muted style={styles.handle}>@{person.username}</Muted>
            </View>
          </Pressable>
          <Button
            kind="secondary"
            title="Unblock"
            disabled={busy === person.username}
            onPress={() => void unblock(person.username)}
          />
        </View>
      ))}
    </View>
  );
}

const useStyles = createThemedStyles((colors) => ({
  list: { gap: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.bdr,
  },
  who: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  name: { color: colors.text, fontFamily: fonts.medium, fontSize: 16 },
  handle: { fontSize: 14 },
}));

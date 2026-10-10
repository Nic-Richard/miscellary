import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';
import type { Creator } from '@miscellary/shared';
import Avatar from '@/components/Avatar';
import { Button, ErrorText, Muted } from '@/components/ui';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { createThemedStyles, fonts } from '@/lib/theme';
import { useMutation } from './actions';

export default function BlockedList() {
  const styles = useStyles();
  const { user } = useAuth();
  const [people, setPeople] = useState<Creator[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const unblock = useMutation<unknown>((_, path) => {
    const username = path.split('/').at(-2);
    setPeople((current) => current?.filter((person) => person.username !== username) ?? null);
  });

  useEffect(() => {
    const controller = new AbortController();
    setError(null);
    void apiFetch<Creator[]>('/api/v1/me/lounge-blocks/', { signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted) setPeople(data);
      })
      .catch((err: unknown) => {
        if (!controller.signal.aborted)
          setError(err instanceof Error ? err.message : 'Could not load blocked collectors.');
      });
    return () => controller.abort();
  }, [user?.id, version]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: 'Blocked collectors' }} />
      <View style={styles.panel}>
        <Muted>
          Blocking only applies to the Lounge: you won’t see each other’s posts, replies or likes
          there. Trades, comments and follows are unchanged.
        </Muted>
        <ErrorText>{error ?? unblock.error}</ErrorText>
        {error && (
          <Button kind="secondary" title="Try again" onPress={() => setVersion((v) => v + 1)} />
        )}
        {!people && !error && <Muted>Loading…</Muted>}
        {people && !people.length && <Muted>You haven’t blocked anyone.</Muted>}
        {people?.map((person) => (
          <View key={person.username} style={styles.row}>
            <Avatar person={person} size={36} />
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{person.display_name || person.username}</Text>
              <Muted style={styles.handle}>@{person.username}</Muted>
            </View>
            <Button
              kind="secondary"
              title="Unblock"
              disabled={unblock.busy}
              onPress={() =>
                void unblock.run(`/api/v1/me/lounge-blocks/${person.username}/`, 'DELETE')
              }
            />
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const useStyles = createThemedStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 12 },
  panel: {
    padding: 16,
    gap: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.bdr,
    backgroundColor: colors.sur,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.bdr,
  },
  name: { color: colors.text, fontFamily: fonts.medium, fontSize: 16 },
  handle: { fontSize: 14 },
}));

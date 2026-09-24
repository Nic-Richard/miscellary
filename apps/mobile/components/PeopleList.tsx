import type { Creator } from '@miscellary/shared';
import { Link } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { listFollows } from '@/lib/endpoints';
import { colors, fonts } from '@/lib/theme';
import DemoBadge from './DemoBadge';
import { ErrorText, Muted } from './ui';

export default function PeopleList({
  username,
  direction,
  onClose,
}: {
  username: string;
  direction: 'followers' | 'following';
  onClose: () => void;
}) {
  const [people, setPeople] = useState<Creator[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPeople(null);
    setError(null);
    setPage(1);
    listFollows(username, direction)
      .then((result) => {
        setPeople(result.results);
        setTotal(result.count);
        setMore(result.next !== null);
      })
      .catch((e: Error) => setError(e.message));
  }, [username, direction]);

  function loadMore() {
    const next = page + 1;
    setBusy(true);
    listFollows(username, direction, next)
      .then((result) => {
        setPeople((current) => [...(current ?? []), ...result.results]);
        setMore(result.next !== null);
        setPage(next);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setBusy(false));
  }

  return (
    <View style={styles.root}>
      <View style={styles.head}>
        <Text style={styles.title}>
          {direction === 'followers' ? 'Followers' : 'Following'}
          {people ? ` · ${total}` : ''}
        </Text>
        <Pressable accessibilityRole="button" hitSlop={8} onPress={onClose}>
          <Text style={styles.close}>Close</Text>
        </Pressable>
      </View>
      <ErrorText>{error}</ErrorText>
      {people === null ? (
        <Muted>Loading…</Muted>
      ) : people.length === 0 ? (
        <Muted>
          {direction === 'followers'
            ? `Nobody follows @${username} yet.`
            : `@${username} is not following anyone yet.`}
        </Muted>
      ) : (
        people.map((p) => (
          <Link
            key={p.username}
            href={{ pathname: '/users/[username]', params: { username: p.username } }}
            style={styles.person}
          >
            <Text style={styles.name}>{p.display_name || p.username}</Text>
            <Text style={styles.handle}> @{p.username}</Text>
            {p.is_demo ? <DemoBadge /> : null}
          </Link>
        ))
      )}
      {more ? (
        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={loadMore}
          style={({ pressed }) => [styles.more, pressed && { opacity: 0.7 }]}
        >
          <Text style={styles.moreText}>
            {busy ? 'Loading…' : `Show more (${total - (people?.length ?? 0)} to go)`}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  more: {
    alignItems: 'center',
    marginTop: 4,
    paddingVertical: 11,
    borderWidth: 1,
    borderColor: colors.bdr2,
    borderRadius: 6,
  },
  moreText: { color: colors.accent, fontFamily: fonts.medium, fontSize: 14 },
  root: {
    gap: 8,
    padding: 12,
    backgroundColor: colors.sur,
    borderWidth: 1,
    borderColor: colors.bdr,
    borderRadius: 8,
  },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: colors.text, fontFamily: fonts.display, fontSize: 22 },
  close: {
    color: colors.accent,
    fontFamily: fonts.medium,
    fontSize: 14,
  },
  person: {
    paddingVertical: 9,
    borderTopWidth: 1,
    borderTopColor: colors.bdr,
  },
  name: { color: colors.text, fontFamily: fonts.medium, fontSize: 15 },
  handle: { color: colors.faint, fontFamily: fonts.body, fontSize: 14 },
});

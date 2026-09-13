import type { Notification } from '@miscellary/shared';
import Feather from '@expo/vector-icons/Feather';
import { router, Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import DemoBadge from '@/components/DemoBadge';
import LoginGate from '@/components/LoginGate';
import { Button, ErrorText, Loading, Muted } from '@/components/ui';
import { getNotifications, markNotificationsRead } from '@/lib/endpoints';
import { colors, fonts } from '@/lib/theme';

const ICONS: Record<Notification['kind'], React.ComponentProps<typeof Feather>['name']> = {
  set_like: 'heart',
  card_like: 'heart',
  set_comment: 'message-square',
  comment_reply: 'corner-up-left',
  follow: 'user-plus',
};

function when(iso: string): string {
  const secs = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60) return 'just now';
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86_400) return `${Math.floor(secs / 3600)}h ago`;
  if (secs < 604_800) return `${Math.floor(secs / 86_400)}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function describe(n: Notification): { text: string; go: (() => void) | null } {
  const set = n.set_title ?? 'a set';
  const slug = n.set_slug;
  const toSet = slug ? () => router.push({ pathname: '/sets/[slug]', params: { slug } }) : null;
  switch (n.kind) {
    case 'set_like':
      return { text: `liked ${set}`, go: toSet };
    case 'card_like':
      return { text: `liked ${n.card_title ?? 'a card'} in ${set}`, go: toSet };
    case 'set_comment':
      return { text: `commented on ${set}`, go: toSet };
    case 'comment_reply':
      return { text: `replied to you on ${set}`, go: toSet };
    case 'follow':
      return {
        text: 'started following you',
        go: () =>
          router.push({ pathname: '/users/[username]', params: { username: n.actor.username } }),
      };
  }
}

function Row({ notification }: { notification: Notification }) {
  const { text, go } = describe(notification);
  const actor = notification.actor;
  const object = notification.card_image ?? notification.set_pack_image;

  return (
    <Pressable
      accessibilityRole={go ? 'link' : 'text'}
      disabled={!go}
      onPress={go ?? undefined}
      style={({ pressed }) => [
        styles.row,
        !notification.read && styles.unread,
        pressed && go ? { opacity: 0.75 } : null,
      ]}
    >
      <View style={[styles.mark, !notification.read && styles.markUnread]}>
        <Feather
          name={ICONS[notification.kind]}
          size={15}
          color={notification.read ? colors.faint : colors.accent}
        />
      </View>
      <View style={styles.line}>
        <View style={styles.said}>
          <Text style={styles.actor}>{actor.display_name || `@${actor.username}`}</Text>
          {actor.is_demo ? <DemoBadge /> : null}
          <Text style={styles.text}> {text}</Text>
        </View>
        {notification.comment_body ? (
          <Text numberOfLines={2} style={styles.quote}>
            “{notification.comment_body}”
          </Text>
        ) : null}
        <Text style={styles.when}>{when(notification.created_at)}</Text>
      </View>
      {object ? (
        <Image
          source={{ uri: object }}
          resizeMode="contain"
          accessibilityIgnoresInvertColors
          style={notification.card_image ? styles.objectCard : styles.objectPack}
        />
      ) : null}
    </Pressable>
  );
}

const FILTERS: { value: 'all' | Notification['kind']; label: string }[] = [
  { value: 'all', label: 'Everything' },
  { value: 'set_like', label: 'Set likes' },
  { value: 'card_like', label: 'Card likes' },
  { value: 'set_comment', label: 'Comments' },
  { value: 'comment_reply', label: 'Replies' },
  { value: 'follow', label: 'Followers' },
];

function Notifications() {
  const [rows, setRows] = useState<Notification[] | null>(null);
  const [filter, setFilter] = useState<'all' | Notification['kind']>('all');
  const [unread, setUnread] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const result = await getNotifications();
      setRows(result.results);
      setUnread(result.unread);
      setTotal(result.count);
      setMore(result.next !== null);
      setPage(1);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load your notifications.');
    }
  }, []);

  async function loadMore() {
    const next = page + 1;
    setBusy(true);
    try {
      const result = await getNotifications(next);
      setRows((current) => [...(current ?? []), ...result.results]);
      setMore(result.next !== null);
      setPage(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load more.');
    } finally {
      setBusy(false);
    }
  }

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function markAll() {
    setRows((current) => current?.map((r) => ({ ...r, read: true })) ?? null);
    setUnread(0);
    try {
      await markNotificationsRead();
    } finally {
      await load();
    }
  }

  if (rows === null) return error ? <ErrorText>{error}</ErrorText> : <Loading />;

  const shown = filter === 'all' ? rows : rows.filter((r) => r.kind === filter);

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            await load();
            setRefreshing(false);
          }}
          colors={[colors.accent]}
          tintColor={colors.accent}
        />
      }
    >
      <View style={styles.head}>
        <Text accessibilityRole="header" style={styles.heading}>
          {unread > 0 ? `${unread} unread` : 'All caught up'}
        </Text>
        {unread > 0 ? (
          <Button title="Mark all read" kind="secondary" onPress={() => void markAll()} />
        ) : null}
      </View>
      <ErrorText>{error}</ErrorText>

      {rows.length ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filters}
          contentContainerStyle={styles.filtersRow}
        >
          {FILTERS.filter((f) => f.value === 'all' || rows.some((r) => r.kind === f.value)).map(
            (f) => (
              <Pressable
                key={f.value}
                accessibilityRole="button"
                accessibilityState={{ selected: filter === f.value }}
                onPress={() => setFilter(f.value)}
                style={[styles.filter, filter === f.value && styles.filterOn]}
              >
                <Text style={[styles.filterText, filter === f.value && styles.filterTextOn]}>
                  {f.label}
                </Text>
              </Pressable>
            ),
          )}
        </ScrollView>
      ) : null}

      {shown.length === 0 ? (
        <View style={styles.empty}>
          <Feather name="bell" size={28} color={colors.cloth} />
          <Text style={styles.emptyTitle}>Nothing yet</Text>
          <Muted>
            You will hear when someone likes or comments on a set of yours, replies to you, or
            follows you — and nothing else.
          </Muted>
        </View>
      ) : (
        shown.map((n) => <Row key={n.id} notification={n} />)
      )}
      {more ? (
        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={() => void loadMore()}
          style={({ pressed }) => [styles.more, pressed && { opacity: 0.7 }]}
        >
          <Text style={styles.moreText}>
            {busy ? 'Loading…' : `Show older (${total - (rows?.length ?? 0)} further back)`}
          </Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

export default function NotificationsScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Notifications' }} />
      <LoginGate message="Log in to see your notifications.">
        <Notifications />
      </LoginGate>
    </>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 40, gap: 8 },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 6,
  },
  heading: { color: colors.text, fontFamily: fonts.display, fontSize: 30 },
  row: {
    flexDirection: 'row',
    gap: 12,
    padding: 12,
    backgroundColor: colors.sur,
    borderWidth: 1,
    borderColor: colors.bdr,
    borderRadius: 8,
  },
  unread: { borderLeftWidth: 3, borderLeftColor: colors.accent },
  mark: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: colors.bdr2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markUnread: { borderColor: colors.accent },
  line: { flex: 1, minWidth: 0, gap: 3 },
  said: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 5 },
  actor: { color: colors.text, fontFamily: fonts.medium, fontSize: 15 },
  text: { color: colors.text, fontFamily: fonts.body, fontSize: 15 },
  quote: { color: colors.muted, fontFamily: fonts.body, fontSize: 13, fontStyle: 'italic' },
  when: { color: colors.faint, fontFamily: fonts.body, fontSize: 11 },
  more: {
    alignItems: 'center',
    marginTop: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: colors.bdr2,
    borderRadius: 7,
  },
  moreText: { color: colors.accent, fontFamily: fonts.medium, fontSize: 13 },
  empty: {
    padding: 24,
    gap: 12,
    backgroundColor: colors.sur,
    borderWidth: 1,
    borderColor: colors.bdr,
    borderRadius: 8,
  },
  emptyTitle: { color: colors.text, fontFamily: fonts.display, fontSize: 26 },
  objectCard: {
    width: 38,
    aspectRatio: 5 / 7,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: colors.bdr2,
  },
  objectPack: { width: 34, aspectRatio: 0.8 },
  filters: { marginBottom: 4 },
  filtersRow: { gap: 8, paddingVertical: 2 },
  filter: {
    borderWidth: 1,
    borderColor: colors.bdr2,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  filterOn: { borderColor: colors.accent, backgroundColor: 'rgba(30,110,103,0.1)' },
  filterText: { color: colors.muted, fontFamily: fonts.body, fontSize: 13 },
  filterTextOn: { color: colors.accent, fontFamily: fonts.medium },
});

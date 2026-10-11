import type { Notification } from '@miscellary/shared';
import Feather from '@expo/vector-icons/Feather';
import { router, Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Image, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import LoginGate from '@/components/LoginGate';
import Avatar from '@/components/Avatar';
import SupporterEmblem from '@/components/SupporterEmblem';
import { Button, Chip, ErrorText, Loading, Muted, Panel, PanelTitle } from '@/components/ui';
import { getNotifications, markNotificationsRead } from '@/lib/endpoints';
import { fonts, useColors, createThemedStyles } from '@/lib/theme';

const ICONS: Record<Notification['kind'], React.ComponentProps<typeof Feather>['name']> = {
  set_like: 'heart',
  card_like: 'heart',
  set_comment: 'message-square',
  comment_reply: 'corner-up-left',
  follow: 'user-plus',
  lounge_reply: 'corner-down-right',
  lounge_mention: 'at-sign',
};

function when(iso: string): string {
  const secs = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60) return 'just now';
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86_400) return `${Math.floor(secs / 3600)}h ago`;
  if (secs < 604_800) return `${Math.floor(secs / 86_400)}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function dayGroup(iso: string): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.floor((today.getTime() - new Date(iso).setHours(0, 0, 0, 0)) / 86_400_000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return 'This week';
  return 'Earlier';
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
    case 'lounge_reply':
    case 'lounge_mention': {
      const where = n.lounge_post_title ? `“${n.lounge_post_title}”` : null;
      const id = n.lounge_post_id;
      return {
        text:
          n.kind === 'lounge_reply'
            ? `replied in ${where ?? 'a discussion'}`
            : `mentioned you in ${where ?? 'the Lounge'}`,
        go: id ? () => router.push(`/lounge/${id}`) : null,
      };
    }
  }
}

function Row({ notification, last }: { notification: Notification; last: boolean }) {
  const colors = useColors();
  const styles = useStyles();
  const { text, go } = describe(notification);
  const actor = notification.actor;
  const object = notification.card_image ?? notification.set_pack_image;
  const quote = notification.comment_body || notification.lounge_reply_body;

  return (
    <Pressable
      accessibilityRole={go ? 'link' : 'text'}
      disabled={!go}
      onPress={go ?? undefined}
      style={({ pressed }) => [
        styles.row,
        !last && styles.rowRule,
        pressed && go ? { opacity: 0.75 } : null,
      ]}
    >
      <View style={styles.who}>
        <Avatar person={{ ...actor, deleted: false }} size={36} />
        <View style={styles.kind}>
          <Feather name={ICONS[notification.kind]} size={10} color={colors.accentText} />
        </View>
      </View>
      <View style={styles.line}>
        <Text style={[styles.text, !notification.read && styles.textUnread]}>
          <Text style={styles.actor}>{actor.display_name || `@${actor.username}`}</Text>
          {actor.supporter_tier ? (
            <SupporterEmblem tier={actor.supporter_tier} size={13} />
          ) : null}{' '}
          {text}
        </Text>
        {quote ? (
          <Text numberOfLines={2} style={styles.quote}>
            “{quote}”
          </Text>
        ) : null}
        <View style={styles.whenRow}>
          {!notification.read && <View accessibilityLabel="Unread" accessible style={styles.dot} />}
          <Text style={styles.when}>{when(notification.created_at)}</Text>
        </View>
      </View>
      <View style={styles.object}>
        {object ? (
          <Image
            source={{ uri: object }}
            resizeMode="contain"
            accessibilityIgnoresInvertColors
            style={notification.card_image ? styles.objectCard : styles.objectPack}
          />
        ) : null}
      </View>
    </Pressable>
  );
}

type Filter = 'all' | 'likes' | 'comments' | 'lounge' | 'follow';

const FILTERS: { value: Filter; label: string; kinds: Notification['kind'][] }[] = [
  { value: 'all', label: 'All', kinds: [] },
  { value: 'likes', label: 'Likes', kinds: ['set_like', 'card_like'] },
  { value: 'comments', label: 'Comments', kinds: ['set_comment', 'comment_reply'] },
  { value: 'lounge', label: 'Lounge', kinds: ['lounge_reply', 'lounge_mention'] },
  { value: 'follow', label: 'Followers', kinds: ['follow'] },
];

function matches(filter: Filter, n: Notification) {
  return filter === 'all' || FILTERS.find((f) => f.value === filter)!.kinds.includes(n.kind);
}

function Notifications() {
  const colors = useColors();
  const styles = useStyles();
  const [rows, setRows] = useState<Notification[] | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
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

  const header = (
    <Stack.Screen
      options={{
        headerRight: () =>
          unread > 0 ? (
            <Button title="Mark all read" kind="quiet" small onPress={() => void markAll()} />
          ) : null,
      }}
    />
  );

  if (rows === null)
    return (
      <>
        {header}
        {error ? <ErrorText>{error}</ErrorText> : <Loading />}
      </>
    );

  const shown = rows.filter((r) => matches(filter, r));
  const days: { label: string; rows: Notification[] }[] = [];
  for (const n of shown) {
    const label = dayGroup(n.created_at);
    if (days.at(-1)?.label === label) days.at(-1)!.rows.push(n);
    else days.push({ label, rows: [n] });
  }

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
      {header}
      <ErrorText>{error}</ErrorText>

      {rows.length ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filters}
        >
          {FILTERS.map((f) => ({ ...f, count: rows.filter((r) => matches(f.value, r)).length }))
            .filter((f) => f.value === 'all' || f.count > 0)
            .map((f) => (
              <Chip
                key={f.value}
                label={f.label}
                count={f.count}
                active={filter === f.value}
                onPress={() => setFilter(f.value)}
              />
            ))}
        </ScrollView>
      ) : null}

      {shown.length === 0 ? (
        <Panel>
          <PanelTitle>Nothing yet</PanelTitle>
          <Muted>
            You will hear when someone likes or comments on a set of yours, follows you, or replies
            to or mentions you.
          </Muted>
        </Panel>
      ) : (
        days.map((day) => (
          <View key={day.label} style={styles.dayGroup}>
            <Text accessibilityRole="header" style={styles.day}>
              {day.label}
            </Text>
            <Panel plain style={styles.dayPanel}>
              {day.rows.map((n, index) => (
                <Row key={n.id} notification={n} last={index === day.rows.length - 1} />
              ))}
            </Panel>
          </View>
        ))
      )}
      {more ? (
        <Button
          title={busy ? 'Loading…' : `Show older (${total - rows.length} further back)`}
          kind="secondary"
          disabled={busy}
          onPress={() => void loadMore()}
        />
      ) : null}
    </ScrollView>
  );
}

export default function NotificationsScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Notifications' }} />
      <LoginGate>
        <Notifications />
      </LoginGate>
    </>
  );
}

const useStyles = createThemedStyles((colors) => ({
  content: { padding: 14, paddingBottom: 40, gap: 14 },
  filters: { gap: 8, paddingVertical: 2 },
  dayGroup: { gap: 6 },
  day: { paddingLeft: 4, color: colors.pageMuted, fontFamily: fonts.medium, fontSize: 14 },
  dayPanel: { paddingVertical: 6, gap: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 72, paddingVertical: 10 },
  rowRule: { borderBottomWidth: 1, borderBottomColor: colors.bdr },
  who: { width: 40 },
  kind: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
    borderWidth: 2,
    borderColor: colors.sur,
  },
  line: { flex: 1, minWidth: 0, gap: 3 },
  actor: { fontFamily: fonts.medium },
  text: { color: colors.muted, fontFamily: fonts.body, fontSize: 15, lineHeight: 20 },
  textUnread: { color: colors.text },
  quote: { color: colors.muted, fontFamily: fonts.body, fontSize: 14, fontStyle: 'italic' },
  whenRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.accent },
  when: { color: colors.faint, fontFamily: fonts.body, fontSize: 13 },
  object: { width: 40, alignItems: 'center' },
  objectCard: {
    width: 38,
    aspectRatio: 5 / 7,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: colors.bdr2,
  },
  objectPack: { width: 34, aspectRatio: 0.8 },
}));

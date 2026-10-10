import { useCallback, useEffect, useRef, useState } from 'react';
import Feather from '@expo/vector-icons/Feather';
import { Stack, router, useFocusEffect } from 'expo-router';
import {
  AppState,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import type { LoungeFeed as Feed, LoungePost, LoungeTopic } from '@miscellary/shared';
import { LOUNGE_TOPICS, cardCode, loungeTopicLabel, timeAgo } from '@miscellary/shared';
import Avatar from '@/components/Avatar';
import CardPreview from '@/components/CardPreview';
import FilterField from '@/components/FilterField';
import MoreButton from '@/components/MoreButton';
import { Button, ErrorText, Muted } from '@/components/ui';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { RETURN_PARAM } from '@/lib/returnTo';
import { createThemedStyles, fonts, useColors } from '@/lib/theme';
import { lounge } from './store';

type Sort = 'active' | 'new' | 'top';
const SORTS: { id: Sort; label: string }[] = [
  { id: 'active', label: 'Active' },
  { id: 'new', label: 'New' },
  { id: 'top', label: 'Top' },
];
const WINDOWS = [
  ['today', 'Today'],
  ['week', 'This week'],
  ['month', 'This month'],
  ['all', 'All time'],
] as const;
const TABS = [{ id: '' as const, label: 'All topics' }, ...LOUNGE_TOPICS];
const NEW_CHECK_MS = 45_000;

export default function LoungeFeed() {
  const colors = useColors();
  const styles = useStyles();
  const { user } = useAuth();
  const list = useRef<FlatList<LoungePost>>(null);
  const [topic, setTopic] = useState<LoungeTopic | ''>('');
  const [sort, setSort] = useState<Sort>('active');
  const [timeWindow, setTimeWindow] = useState('week');
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<LoungePost[]>([]);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enabled, setEnabled] = useState(true);
  const [version, setVersion] = useState(0);
  const [since, setSince] = useState<string | null>(null);
  const [newCount, setNewCount] = useState(0);

  useEffect(() => {
    const next = query.trim();
    if (next === search) return;
    const timer = setTimeout(() => {
      setSearch(next);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [query, search]);

  useEffect(() => {
    const controller = new AbortController();
    const startedAt = new Date().toISOString();
    const params = new URLSearchParams({ sort, window: timeWindow, page: String(page) });
    if (topic) params.set('topic', topic);
    if (search) params.set('q', search);
    setLoading(true);
    void apiFetch<Feed>(`/api/v1/lounge/?${params}`, { signal: controller.signal })
      .then((data) => {
        if (controller.signal.aborted) return;
        setEnabled(data.enabled);
        lounge.subscriber = data.subscriber;
        setHasNext(Boolean(data.next));
        setError(null);
        if (page === 1) {
          setRows(data.results);
          setSince(startedAt);
          setNewCount(0);
        } else {
          // Pages shift as people post, so skip anything already on screen.
          setRows((current) => {
            const seen = new Set(current.map((row) => row.id));
            return [...current, ...data.results.filter((row) => !seen.has(row.id))];
          });
        }
      })
      .catch((err: unknown) => {
        if (!controller.signal.aborted)
          setError(err instanceof Error ? err.message : 'Could not load the Lounge.');
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
          setRefreshing(false);
        }
      });
    return () => controller.abort();
  }, [topic, sort, timeWindow, search, page, version, user?.id]);

  useFocusEffect(
    useCallback(() => {
      if (!since || search || !enabled) return;
      const controller = new AbortController();
      const check = () => {
        if (AppState.currentState !== 'active') return;
        const params = new URLSearchParams({ new_since: since });
        if (topic) params.set('topic', topic);
        void apiFetch<{ new_count: number }>(`/api/v1/lounge/?${params}`, {
          signal: controller.signal,
        })
          .then((data) => {
            if (!controller.signal.aborted) setNewCount(data.new_count);
          })
          .catch(() => undefined);
      };
      const timer = setInterval(check, NEW_CHECK_MS);
      return () => {
        clearInterval(timer);
        controller.abort();
      };
    }, [since, search, enabled, topic]),
  );

  useEffect(
    () =>
      lounge.listen((event) => {
        if (event.type === 'patch')
          setRows((current) =>
            current.map((row) => (row.id === event.id ? { ...row, ...event.patch } : row)),
          );
        else if (event.type === 'hide')
          setRows((current) => current.filter((row) => row.author?.username !== event.username));
        else {
          setRows((current) => [event.post, ...current.filter((row) => row.id !== event.post.id)]);
          list.current?.scrollToOffset({ offset: 0, animated: false });
        }
      }),
    [],
  );

  const reload = useCallback(() => {
    setPage(1);
    setVersion((value) => value + 1);
  }, []);

  function startDiscussion() {
    if (!user) router.push(`/login?${RETURN_PARAM}=${encodeURIComponent('/lounge')}`);
    else router.push(topic ? `/lounge/new?topic=${topic}` : '/lounge/new');
  }

  const header = (
    <View style={styles.header}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabs}
        accessibilityRole="tablist"
      >
        {TABS.map((item) => {
          const active = topic === item.id;
          return (
            <Pressable
              key={item.id}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              onPress={() => {
                setTopic(item.id);
                setPage(1);
              }}
              style={[styles.tab, active && styles.tabActive]}
            >
              <Text style={[styles.tabText, active && styles.tabTextActive]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <View style={styles.tools}>
        <View style={styles.searchRow}>
          <FilterField
            value={query}
            onChange={setQuery}
            label="Search the Lounge"
            placeholder={topic ? `Search ${loungeTopicLabel(topic)}` : 'Search discussions'}
            style={{ flex: 1 }}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Start a discussion"
            onPress={startDiscussion}
            style={({ pressed }) => [styles.compose, pressed && { opacity: 0.8 }]}
          >
            <Feather name="edit-3" size={20} color={colors.accentText} />
          </Pressable>
        </View>
        <View style={styles.sorts} accessibilityRole="radiogroup">
          {SORTS.map((item) => {
            const active = sort === item.id;
            return (
              <Pressable
                key={item.id}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                onPress={() => {
                  setSort(item.id);
                  setPage(1);
                }}
                style={[styles.sort, active && styles.sortActive]}
              >
                <Text style={[styles.sortText, active && styles.sortTextActive]}>{item.label}</Text>
              </Pressable>
            );
          })}
        </View>
        {sort === 'top' && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.windows}
          >
            {WINDOWS.map(([value, label]) => {
              const active = timeWindow === value;
              return (
                <Pressable
                  key={value}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  onPress={() => {
                    setTimeWindow(value);
                    setPage(1);
                  }}
                  style={[styles.window, active && styles.windowActive]}
                >
                  <Text style={[styles.windowText, active && styles.windowTextActive]}>
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        )}
      </View>
    </View>
  );

  const empty = error ? (
    <View style={styles.note}>
      <ErrorText>{error}</ErrorText>
      <Button kind="secondary" title="Try again" onPress={reload} />
    </View>
  ) : loading ? (
    <Muted style={styles.noteText}>Loading discussions…</Muted>
  ) : (
    <Muted style={styles.noteText}>
      {search
        ? 'No discussions match that search.'
        : topic
          ? `Nothing in ${loungeTopicLabel(topic)} yet. Start the first discussion.`
          : 'No discussions yet. Start the first one.'}
    </Muted>
  );

  return (
    <View style={styles.screen}>
      <Stack.Screen
        options={{
          title: 'Lounge',
          headerRight: () =>
            user ? (
              <MoreButton
                title="Lounge"
                items={[
                  {
                    label: 'Membership',
                    icon: 'star',
                    onSelect: () => router.push('/settings'),
                  },
                  {
                    label: 'Blocked collectors',
                    icon: 'slash',
                    onSelect: () => router.push('/lounge/blocked'),
                  },
                ]}
              />
            ) : (
              <Pressable
                accessibilityRole="link"
                hitSlop={8}
                onPress={() =>
                  router.push(`/login?${RETURN_PARAM}=${encodeURIComponent('/lounge')}`)
                }
              >
                <Text style={styles.headerLink}>Log in</Text>
              </Pressable>
            ),
        }}
      />
      {!enabled ? (
        <Muted style={styles.noteText}>The Lounge is not open yet.</Muted>
      ) : (
        <FlatList
          ref={list}
          data={rows}
          keyExtractor={(post) => post.id}
          renderItem={({ item }) => <Row post={item} showTopic={!topic} />}
          ListHeaderComponent={header}
          ListEmptyComponent={empty}
          ListFooterComponent={
            rows.length > 0 && (loading || error) ? (
              <View style={styles.note}>
                {error ? (
                  <>
                    <ErrorText>{error}</ErrorText>
                    <Button
                      kind="secondary"
                      title="Try again"
                      onPress={() => setVersion((value) => value + 1)}
                    />
                  </>
                ) : (
                  <Muted style={styles.noteText}>Loading more…</Muted>
                )}
              </View>
            ) : null
          }
          onEndReached={() => {
            if (hasNext && !loading && !error) setPage((value) => value + 1);
          }}
          onEndReachedThreshold={0.6}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              colors={[colors.accent]}
              tintColor={colors.accent}
              onRefresh={() => {
                setRefreshing(true);
                reload();
              }}
            />
          }
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={styles.content}
        />
      )}
      {newCount > 0 && (
        <View style={styles.pillWrap} pointerEvents="box-none">
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              list.current?.scrollToOffset({ offset: 0, animated: true });
              reload();
            }}
            style={({ pressed }) => [styles.pill, pressed && { opacity: 0.85 }]}
          >
            <Feather name="arrow-up" size={15} color={colors.accentText} />
            <Text style={styles.pillText}>
              {newCount} new {newCount === 1 ? 'discussion' : 'discussions'}
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

function Row({ post, showTopic }: { post: LoungePost; showTopic: boolean }) {
  const colors = useColors();
  const styles = useStyles();
  const name = post.author?.display_name || post.author?.username || 'Deleted collector';
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${post.title}, by ${name}, ${post.reply_count} ${post.reply_count === 1 ? 'reply' : 'replies'}`}
      onPress={() => router.push(`/lounge/${post.id}`)}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.sur2 }]}
    >
      <Fan post={post} />
      <View style={styles.rowMain}>
        <Text style={styles.rowTitle} numberOfLines={2}>
          {post.title}
        </Text>
        <View style={styles.meta}>
          <View style={styles.who}>
            <Avatar person={post.author} supporter={post.author_badge} size={18} />
            <Text style={styles.metaText} numberOfLines={1}>
              {name}
            </Text>
          </View>
          {showTopic && <Text style={styles.topic}>{loungeTopicLabel(post.topic)}</Text>}
          <View style={styles.count}>
            <Feather name="message-square" size={13} color={colors.faint} />
            <Text style={styles.metaText}>{post.reply_count}</Text>
          </View>
          <Text style={styles.metaText}>{timeAgo(post.created_at)}</Text>
        </View>
      </View>
    </Pressable>
  );
}

function Fan({ post }: { post: LoungePost }) {
  const colors = useColors();
  const styles = useStyles();
  const cards = post.cards.filter((card) => card !== null).slice(0, 3);
  if (!cards.length)
    return (
      <View style={styles.fanText}>
        <Feather name="message-square" size={18} color={colors.faint} />
      </View>
    );
  const spots =
    cards.length === 1
      ? [{ left: 10, rotate: '0deg' }]
      : [
          { left: 0, rotate: '-7deg' },
          { left: 10, rotate: '0deg' },
          { left: 20, rotate: '7deg' },
        ];
  return (
    <View style={styles.fan}>
      {cards.map((card, index) => (
        <View
          key={card.id}
          style={[
            styles.fanCard,
            { left: spots[index]!.left, transform: [{ rotate: spots[index]!.rotate }] },
          ]}
        >
          <CardPreview
            width={34}
            title={card.title}
            rarity={card.rarity}
            imageUrl={card.image?.url ?? null}
            templateKey={card.template_key}
            templateConfig={card.template_config}
            code={cardCode(card.printed_set_code, card.position, card.set_total)}
            printedText={card.printed_text}
            render={card.render}
          />
        </View>
      ))}
    </View>
  );
}

const useStyles = createThemedStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingBottom: 40, flexGrow: 1 },
  header: { backgroundColor: colors.bg },
  headerLink: { color: colors.pageAccent, fontFamily: fonts.medium, fontSize: 16 },
  tabs: {
    paddingHorizontal: 12,
    gap: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.bdr,
    minWidth: '100%',
  },
  tab: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 8,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    marginBottom: -1,
  },
  tabActive: { borderBottomColor: colors.pageAccent },
  tabText: { color: colors.pageMuted, fontFamily: fonts.medium, fontSize: 15 },
  tabTextActive: { color: colors.pageText },
  tools: { padding: 16, paddingBottom: 8, gap: 10 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  compose: {
    width: 46,
    height: 46,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
  },
  sorts: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    padding: 3,
    borderRadius: 8,
    backgroundColor: colors.sur2,
    borderWidth: 1,
    borderColor: colors.bdr,
  },
  sort: { minHeight: 34, paddingHorizontal: 14, justifyContent: 'center', borderRadius: 6 },
  sortActive: { backgroundColor: colors.sur },
  sortText: { color: colors.muted, fontFamily: fonts.medium, fontSize: 14 },
  sortTextActive: { color: colors.text },
  windows: { gap: 6 },
  window: {
    minHeight: 32,
    paddingHorizontal: 11,
    justifyContent: 'center',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.bdr2,
  },
  windowActive: { borderColor: colors.accent, backgroundColor: colors.accent },
  windowText: { color: colors.pageMuted, fontFamily: fonts.medium, fontSize: 13 },
  windowTextActive: { color: colors.accentText },
  row: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 12,
    marginBottom: 6,
    borderRadius: 10,
    backgroundColor: colors.sur,
    borderWidth: 1,
    borderColor: colors.bdr,
  },
  rowMain: { flex: 1, gap: 6, justifyContent: 'center' },
  rowTitle: { color: colors.text, fontFamily: fonts.medium, fontSize: 17, lineHeight: 21 },
  meta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 12, rowGap: 4 },
  who: { flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: '60%' },
  metaText: { color: colors.muted, fontFamily: fonts.body, fontSize: 13 },
  topic: { color: colors.accentInk, fontFamily: fonts.medium, fontSize: 13 },
  count: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  fan: { width: 56, height: 56 },
  fanCard: {
    position: 'absolute',
    top: 3,
    borderRadius: 3,
    overflow: 'hidden',
    elevation: 2,
  },
  fanText: {
    width: 44,
    height: 44,
    margin: 6,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.bdr2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  note: { padding: 16, gap: 10 },
  noteText: { padding: 16, color: colors.pageMuted },
  pillWrap: { position: 'absolute', top: 12, left: 0, right: 0, alignItems: 'center' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: colors.accent,
    elevation: 4,
  },
  pillText: { color: colors.accentText, fontFamily: fonts.medium, fontSize: 14 },
}));

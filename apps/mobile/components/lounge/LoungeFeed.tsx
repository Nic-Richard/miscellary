import { useCallback, useEffect, useRef, useState } from 'react';
import Feather from '@expo/vector-icons/Feather';
import { router, useFocusEffect } from 'expo-router';
import {
  AppState,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { LoungeFeed as Feed, LoungePost, LoungeTopic, SavedFolder } from '@miscellary/shared';
import { LOUNGE_TOPICS, cardCode, loungeTopicLabel, timeAgo } from '@miscellary/shared';
import Avatar from '@/components/Avatar';
import CardPreview from '@/components/CardPreview';
import FilterField from '@/components/FilterField';
import MoreButton from '@/components/MoreButton';
import { Board, Button, Chip, ErrorText, Muted, Segmented } from '@/components/ui';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { listFolders } from '@/lib/lounge';
import { RETURN_PARAM } from '@/lib/returnTo';
import Svg, { Path } from 'react-native-svg';
import { createThemedStyles, fonts, useColors } from '@/lib/theme';
import { lounge } from './store';
import SupporterEmblem from '@/components/SupporterEmblem';

type Sort = 'active' | 'new' | 'top';
const SORTS: { value: Sort; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'new', label: 'New' },
  { value: 'top', label: 'Top' },
];
const WINDOWS = [
  ['today', 'Today'],
  ['week', 'This week'],
  ['month', 'This month'],
  ['all', 'All time'],
] as const;
const TABS = [
  { value: '' as const, label: 'All topics' },
  ...LOUNGE_TOPICS.map((item) => ({ value: item.id, label: item.label })),
];
const NEW_CHECK_MS = 45_000;
// How close to the bottom, in points, before the next page loads.
const MORE_AHEAD = 600;

type FeedView = 'all' | 'saved' | 'drafts';

export default function LoungeFeed() {
  const colors = useColors();
  const styles = useStyles();
  const { user } = useAuth();
  const list = useRef<ScrollView>(null);
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
  const [view, setView] = useState<FeedView>('all');
  const [folder, setFolder] = useState('');
  const [folders, setFolders] = useState<SavedFolder[]>([]);
  const [subscriber, setSubscriber] = useState(Boolean(lounge.subscriber));
  const tabsWidth = useRef(0);
  const [tabEdges, setTabEdges] = useState({ start: false, end: false });
  const viewRef = useRef(view);
  viewRef.current = view;

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
    if (view === 'saved') params.set('saved', '1');
    if (view === 'saved' && folder) params.set('folder', folder);
    const url =
      view === 'drafts' ? `/api/v1/me/lounge/drafts/?page=${page}` : `/api/v1/lounge/?${params}`;
    setLoading(true);
    void apiFetch<Feed>(url, { signal: controller.signal })
      .then((data) => {
        if (controller.signal.aborted) return;
        if (view === 'all') {
          setEnabled(data.enabled);
          lounge.subscriber = data.subscriber;
          setSubscriber(data.subscriber);
        }
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
  }, [topic, sort, timeWindow, search, page, version, view, folder, user?.id]);

  useEffect(() => {
    if (view === 'saved' && subscriber)
      void listFolders()
        .then(setFolders)
        .catch(() => undefined);
  }, [view, subscriber]);

  useFocusEffect(
    useCallback(() => {
      if (!since || search || !enabled || view !== 'all') return;
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
    }, [since, search, enabled, topic, view]),
  );

  useEffect(
    () =>
      lounge.listen((event) => {
        if (event.type === 'patch')
          setRows((current) =>
            current
              .map((row) => (row.id === event.id ? { ...row, ...event.patch } : row))
              // Unsaving from the saved view takes the discussion out of it.
              .filter((row) => viewRef.current !== 'saved' || row.saved),
          );
        else if (event.type === 'hide')
          setRows((current) => current.filter((row) => row.author?.username !== event.username));
        else if (viewRef.current === 'drafts')
          setRows((current) =>
            event.post.draft
              ? [event.post, ...current.filter((row) => row.id !== event.post.id)]
              : current.filter((row) => row.id !== event.post.id),
          );
        else if (viewRef.current === 'all' && !event.post.draft) {
          setRows((current) => [event.post, ...current.filter((row) => row.id !== event.post.id)]);
          list.current?.scrollTo({ y: 0, animated: false });
        }
      }),
    [],
  );

  function showView(next: FeedView) {
    setView(next);
    setFolder('');
    setRows([]);
    setPage(1);
  }

  const reload = useCallback(() => {
    setPage(1);
    setVersion((value) => value + 1);
  }, []);

  function startDiscussion() {
    if (!user) router.push(`/login?${RETURN_PARAM}=${encodeURIComponent('/lounge')}`);
    else router.push(topic ? `/lounge/new?topic=${topic}` : '/lounge/new');
  }

  const savedFilters = [
    { value: '', label: 'Everything saved' },
    { value: 'none', label: 'Not in a folder' },
    ...folders.map((item) => ({ value: String(item.id), label: item.name })),
  ];

  const topicTabs = (
    <View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabs}
        accessibilityRole="tablist"
        accessibilityLabel="Topics"
        scrollEventThrottle={32}
        onScroll={({ nativeEvent: { contentOffset, contentSize, layoutMeasurement } }) =>
          setTabEdges({
            start: contentOffset.x > 4,
            end: contentOffset.x + layoutMeasurement.width < contentSize.width - 4,
          })
        }
        onContentSizeChange={(contentWidth) =>
          setTabEdges((edges) => ({ ...edges, end: contentWidth > tabsWidth.current + 4 }))
        }
        onLayout={(event) => {
          tabsWidth.current = event.nativeEvent.layout.width;
        }}
      >
        {TABS.map((item) => {
          const active = topic === item.value;
          return (
            <Pressable
              key={item.value}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              onPress={() => {
                setTopic(item.value);
                setPage(1);
              }}
              style={[styles.tab, active && styles.tabActive]}
            >
              <Text style={[styles.tabText, active && styles.tabTextActive]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      {tabEdges.start && <View pointerEvents="none" style={[styles.fade, styles.fadeStart]} />}
      {tabEdges.end && <View pointerEvents="none" style={[styles.fade, styles.fadeEnd]} />}
    </View>
  );

  const header =
    view !== 'all' ? (
      <View style={styles.tools}>
        <Pressable
          accessibilityRole="button"
          hitSlop={8}
          onPress={() => showView('all')}
          style={styles.back}
        >
          <Feather name="arrow-left" size={16} color={colors.pageAccent} />
          <Text style={styles.headerLink}>All discussions</Text>
        </Pressable>
        <Text accessibilityRole="header" style={styles.viewTitle}>
          {view === 'saved' ? 'Saved discussions' : 'Your drafts'}
        </Text>
        {view === 'saved' && folders.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.windows}
          >
            {savedFilters.map((item) => (
              <Chip
                key={item.value}
                label={item.label}
                active={folder === item.value}
                onPress={() => {
                  setFolder(item.value);
                  setPage(1);
                }}
              />
            ))}
          </ScrollView>
        )}
      </View>
    ) : (
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
          {user && (
            <MoreButton
              title="Lounge"
              items={[
                {
                  label: 'Saved discussions',
                  icon: 'bookmark',
                  onSelect: () => showView('saved'),
                },
                ...(subscriber
                  ? [
                      {
                        label: 'Drafts',
                        icon: 'file-text' as const,
                        onSelect: () => showView('drafts'),
                      },
                    ]
                  : []),
                {
                  label: 'Blocked collectors',
                  icon: 'slash',
                  onSelect: () => router.push('/blocked'),
                },
                { label: 'Membership', icon: 'star', onSelect: () => router.push('/membership') },
              ]}
            />
          )}
        </View>
        <Segmented
          options={SORTS}
          value={sort}
          label="Sort discussions"
          onChange={(next) => {
            setSort(next);
            setPage(1);
          }}
        />
        {sort === 'top' && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.windows}
          >
            {WINDOWS.map(([value, label]) => (
              <Chip
                key={value}
                label={label}
                active={timeWindow === value}
                onPress={() => {
                  setTimeWindow(value);
                  setPage(1);
                }}
              />
            ))}
          </ScrollView>
        )}
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
      {view === 'saved'
        ? 'Nothing saved yet. Use Save on a discussion to keep it here.'
        : view === 'drafts'
          ? 'No drafts. Choose Save as draft when starting a discussion.'
          : search
            ? 'No discussions match that search.'
            : topic
              ? `Nothing in ${loungeTopicLabel(topic)} yet. Start the first discussion.`
              : 'No discussions yet. Start the first one.'}
    </Muted>
  );

  return (
    <View style={styles.screen}>
      {!enabled ? (
        <Muted style={styles.noteText}>The Lounge is not open yet.</Muted>
      ) : (
        <ScrollView
          ref={list}
          scrollEventThrottle={200}
          onScroll={({ nativeEvent: { layoutMeasurement, contentOffset, contentSize } }) => {
            const near =
              layoutMeasurement.height + contentOffset.y >= contentSize.height - MORE_AHEAD;
            if (near && hasNext && !loading && !error) setPage((value) => value + 1);
          }}
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
        >
          <Board style={styles.board}>
            {view === 'all' && topicTabs}
            {header}
            <View style={styles.rows}>
              <View style={styles.inner} />
              {rows.length === 0
                ? empty
                : rows.map((post) => (
                    <Row key={post.id} post={post} showTopic={!topic || view !== 'all'} />
                  ))}
              {rows.length > 0 && (loading || error) ? (
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
              ) : null}
            </View>
          </Board>
        </ScrollView>
      )}
      {newCount > 0 && view === 'all' && (
        <View style={styles.pillWrap} pointerEvents="box-none">
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              list.current?.scrollTo({ y: 0, animated: true });
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
  const replies = `${post.reply_count} ${post.reply_count === 1 ? 'reply' : 'replies'}`;
  const [size, setSize] = useState({ width: 0, height: 0 });
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${post.title}, by ${name}, ${post.score} votes, ${replies}`}
      onPress={() => router.push(`/lounge/${post.id}`)}
      onLayout={(event) => setSize(event.nativeEvent.layout)}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.85 }]}
    >
      {size.width > 0 && <Slip width={size.width} height={size.height} />}
      <View style={styles.stub}>
        <Text style={styles.stubScore}>{post.score}</Text>
        <Text style={styles.stubLabel}>{Math.abs(post.score) === 1 ? 'VOTE' : 'VOTES'}</Text>
      </View>
      <View style={styles.rowMain}>
        <Text style={styles.rowTitle} numberOfLines={2}>
          {post.title}
        </Text>
        {post.body ? (
          <Text style={styles.excerpt} numberOfLines={1}>
            {post.body}
          </Text>
        ) : null}
        <View style={styles.meta}>
          <View style={styles.who}>
            <Avatar person={post.author} badge={post.author_badge} size={18} />
            <Text style={styles.metaText} numberOfLines={1}>
              {name}
            </Text>
            <SupporterEmblem tier={post.author?.supporter_tier} size={13} />
          </View>
          {showTopic && <Text style={styles.topic}>{loungeTopicLabel(post.topic)}</Text>}
          <View style={styles.count}>
            <Feather name="message-square" size={13} color={colors.faint} />
            <Text style={styles.metaText}>{post.reply_count}</Text>
          </View>
          <Text style={styles.metaText}>{timeAgo(post.created_at)}</Text>
          {post.unread && <Text style={styles.tag}>New replies</Text>}
          {post.draft && <Text style={styles.tag}>Draft</Text>}
        </View>
      </View>
      <Fan post={post} />
    </Pressable>
  );
}

const STUB = 58;
const NOTCH = 6;
const RADIUS = 10;

function Slip({ width, height }: { width: number; height: number }) {
  const colors = useColors();
  const w = width - 1;
  const h = height - 1;
  const [r, x, n] = [RADIUS, STUB, NOTCH];
  const outline = [
    `M ${r} 0 H ${x - n} A ${n} ${n} 0 0 0 ${x + n} 0 H ${w - r} A ${r} ${r} 0 0 1 ${w} ${r}`,
    `V ${h - r} A ${r} ${r} 0 0 1 ${w - r} ${h} H ${x + n} A ${n} ${n} 0 0 0 ${x - n} ${h}`,
    `H ${r} A ${r} ${r} 0 0 1 0 ${h - r} V ${r} A ${r} ${r} 0 0 1 ${r} 0 Z`,
  ].join(' ');
  const stub = [
    `M ${r} 0 H ${x - n} A ${n} ${n} 0 0 0 ${x} ${n} V ${h - n} A ${n} ${n} 0 0 0 ${x - n} ${h}`,
    `H ${r} A ${r} ${r} 0 0 1 0 ${h - r} V ${r} A ${r} ${r} 0 0 1 ${r} 0 Z`,
  ].join(' ');
  return (
    <Svg width={width} height={height} style={{ position: 'absolute', top: 0, left: 0 }}>
      <Path d={outline} transform="translate(0.5 0.5)" fill={colors.sur} />
      <Path d={stub} transform="translate(0.5 0.5)" fill={colors.sur2} />
      <Path
        d={`M ${x + 0.5} ${n + 5} V ${h - n - 4}`}
        stroke={colors.bdr2}
        strokeWidth={2}
        strokeDasharray="4 4"
      />
      <Path d={outline} transform="translate(0.5 0.5)" fill="none" stroke={colors.bdr} />
    </Svg>
  );
}

function Fan({ post }: { post: LoungePost }) {
  const styles = useStyles();
  const cards = post.cards.filter((card) => card !== null).slice(0, 3);
  if (!cards.length) return null;
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
  content: { padding: 14, paddingBottom: 40 },
  board: { borderTopLeftRadius: 14 },
  tabs: {
    paddingHorizontal: 8,
    gap: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.bdr,
    minWidth: '100%',
  },
  tab: {
    minHeight: 46,
    justifyContent: 'center',
    paddingHorizontal: 8,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    marginBottom: -1,
  },
  tabActive: { borderBottomColor: colors.accent },
  fade: { position: 'absolute', top: 0, bottom: 1, width: 44 },
  fadeStart: {
    left: 0,
    experimental_backgroundImage: `linear-gradient(to left, transparent, ${colors.sur})`,
  },
  fadeEnd: {
    right: 0,
    experimental_backgroundImage: `linear-gradient(to right, transparent, ${colors.sur})`,
  },
  tabText: { color: colors.muted, fontFamily: fonts.medium, fontSize: 15 },
  tabTextActive: { color: colors.text },
  headerLink: { color: colors.accentInk, fontFamily: fonts.medium, fontSize: 16 },
  tools: { padding: 12, gap: 10 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  compose: {
    width: 46,
    height: 46,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
  },
  windows: { gap: 6 },
  rows: { paddingTop: 12, paddingBottom: 4, minHeight: 200 },
  inner: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.sur2, opacity: 0.45 },
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
    marginHorizontal: 10,
    marginBottom: 12,
    paddingRight: 10,
  },
  stub: {
    width: STUB,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  stubScore: { color: colors.accentInk, fontFamily: fonts.display, fontSize: 24, lineHeight: 26 },
  stubLabel: { color: colors.faint, fontFamily: fonts.medium, fontSize: 11, letterSpacing: 1 },
  rowMain: { flex: 1, gap: 4, justifyContent: 'center', paddingVertical: 10, paddingLeft: 14 },
  excerpt: { color: colors.muted, fontFamily: fonts.body, fontSize: 14 },
  tag: {
    color: colors.accentInk,
    fontFamily: fonts.medium,
    fontSize: 13,
    paddingHorizontal: 7,
    paddingVertical: 1,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.accent,
    overflow: 'hidden',
  },
  back: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
  viewTitle: { color: colors.text, fontFamily: fonts.display, fontSize: 28 },
  rowTitle: { color: colors.text, fontFamily: fonts.medium, fontSize: 17, lineHeight: 21 },
  meta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 12, rowGap: 4 },
  who: { flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: '60%' },
  metaText: { color: colors.muted, fontFamily: fonts.body, fontSize: 13 },
  topic: { color: colors.accentInk, fontFamily: fonts.medium, fontSize: 13 },
  count: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  fan: { width: 56, height: 56, alignSelf: 'center' },
  fanCard: {
    position: 'absolute',
    top: 3,
    borderRadius: 3,
    overflow: 'hidden',
    elevation: 2,
  },
  note: { padding: 16, gap: 10 },
  noteText: { padding: 16, color: colors.muted },
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

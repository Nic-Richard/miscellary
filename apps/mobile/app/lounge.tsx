import { useEffect, useRef, useState } from 'react';
import { Stack, router } from 'expo-router';
import {
  Alert,
  FlatList,
  Pressable,
  ScrollView,
  Switch,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import type {
  Creator,
  LoungeFeed,
  LoungeCard,
  LoungePost,
  LoungeReply,
  LoungeStyle,
  OwnedCard,
  Paginated,
} from '@miscellary/shared';
import { cardCode } from '@miscellary/shared';
import CardPreview from '@/components/CardPreview';
import CardInspector from '@/components/CardInspector';
import InspectorModal from '@/components/InspectorModal';
import SharedSurface from '@/components/SharedSurface';
import ActionChip from '@/components/ActionChip';
import ShareButton from '@/components/ShareButton';
import MoreButton from '@/components/MoreButton';
import SupporterBadge from '@/components/SupporterBadge';
import { Composer } from '@/components/Comments';
import FilterField from '@/components/FilterField';
import { listMyCards } from '@/lib/endpoints';
import ReportSheet from '@/components/ReportSheet';
import type { ReportTarget } from '@/components/ReportSheet';
import { Button, Chip, ErrorText, Input, Muted } from '@/components/ui';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { createThemedStyles, fonts } from '@/lib/theme';

const RULES =
  'Keep it kind and collection-related. No harassment, adult content, spam or stolen work. Share only cards you own; report problems for a moderator to review. Supporters follow the same rules.';

function LoungeLike({
  path,
  liked: initialLiked,
  count: initialCount,
}: {
  path: string;
  liked: boolean;
  count: number;
}) {
  const { user } = useAuth();
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const request = useRef<AbortController | null>(null);
  useEffect(() => {
    setLiked(initialLiked);
    setCount(initialCount);
  }, [initialLiked, initialCount]);
  useEffect(() => () => request.current?.abort(), [user?.id]);
  async function toggle() {
    if (!user) {
      router.push('/login');
      return;
    }
    if (request.current && !request.current.signal.aborted) return;
    const controller = new AbortController();
    request.current = controller;
    const next = !liked;
    setLiked(next);
    setCount(count + (next ? 1 : -1));
    setBusy(true);
    setError(null);
    try {
      const result = await apiFetch<{ liked: boolean; likes: number }>(path, {
        method: next ? 'POST' : 'DELETE',
        signal: controller.signal,
      });
      if (!controller.signal.aborted) {
        setLiked(result.liked);
        setCount(result.likes);
      }
    } catch (err) {
      if (!controller.signal.aborted) {
        setLiked(liked);
        setCount(count);
        setError(err instanceof Error ? err.message : 'Could not update like.');
      }
    } finally {
      controller.abort();
      if (request.current === controller) setBusy(false);
    }
  }
  return (
    <View>
      <ActionChip
        icon="heart"
        count={count}
        tone={liked ? 'liked' : 'plain'}
        disabled={busy}
        accessibilityLabel={liked ? 'Unlike' : 'Like'}
        onPress={() => void toggle()}
      />
      <ErrorText>{error}</ErrorText>
    </View>
  );
}

function useMutation<T>(onDone: (result: T, path: string, method: string) => void) {
  const { user } = useAuth();
  const current = useRef<AbortController | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setBusy(false);
    setError(null);
    return () => {
      current.current?.abort();
      current.current = null;
    };
  }, [user?.id]);
  async function run(path: string, method: string, body?: unknown, throwOnError = false) {
    if (current.current) return false;
    const controller = new AbortController();
    current.current = controller;
    setBusy(true);
    setError(null);
    try {
      const result = await apiFetch<T>(path, {
        method,
        signal: controller.signal,
        ...(body ? { body } : {}),
      });
      if (controller.signal.aborted) return false;
      onDone(result, path, method);
      return true;
    } catch (err) {
      if (!controller.signal.aborted)
        setError(err instanceof Error ? err.message : 'Please try again.');
      if (throwOnError) throw err;
      return false;
    } finally {
      if (current.current === controller) {
        current.current = null;
        setBusy(false);
      }
    }
  }
  return { run, busy, error };
}

function confirmRemoval(title: string, action: () => void) {
  Alert.alert(title, 'The content will be removed; replies keep their place.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Remove', style: 'destructive', onPress: action },
  ]);
}

function Thread({
  postId,
  parentId,
  removed = false,
  onCountChange,
}: {
  postId: string;
  parentId?: string;
  removed?: boolean;
  onCountChange?: (delta: number) => void;
}) {
  const styles = useStyles();
  const { user } = useAuth();
  const [rows, setRows] = useState<LoungeReply[]>([]);
  const [page, setPage] = useState(1);
  const [next, setNext] = useState(false);
  const [version, setVersion] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<string | null>(null);
  const [report, setReport] = useState<ReportTarget | null>(null);
  const mutation = useMutation<LoungeReply>((result, path, method) => {
    if (method === 'POST') {
      setRows((current) => [...current, result]);
      onCountChange?.(1);
    } else {
      const id = path.split('/').at(-2);
      const existing = rows.find((row) => row.id === id);
      setRows((current) =>
        current.map((row) =>
          row.id === id
            ? {
                ...row,
                removed: true,
                body: '',
                author: null,
                author_badge: false,
                likes: 0,
                liked: false,
              }
            : row,
        ),
      );
      if (existing && !existing.removed) onCountChange?.(-1);
    }
  });
  useEffect(() => {
    setRows([]);
    setReport(null);
    setOpen(null);
  }, [user?.id]);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    void apiFetch<Paginated<LoungeReply>>(
      `/api/v1/lounge/posts/${postId}/replies/?page=${page}${parentId ? `&parent_id=${parentId}` : ''}`,
      { signal: controller.signal },
    )
      .then((data) => {
        if (!controller.signal.aborted) {
          setRows(data.results);
          setNext(Boolean(data.next));
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (!controller.signal.aborted)
          setError(err instanceof Error ? err.message : 'Could not load replies.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [postId, parentId, page, version, user?.id]);
  return (
    <View style={styles.thread}>
      {user && !removed && (
        <Composer
          placeholder={parentId ? 'Reply to this thread' : 'Join the discussion'}
          submitLabel="Post reply"
          disabled={loading}
          onSubmit={async (body) => {
            const done = await mutation.run(
              `/api/v1/lounge/posts/${postId}/replies/`,
              'POST',
              { body, parent_id: parentId ?? null },
              true,
            );
            if (!done) throw new Error('Your reply has not been posted. Please try again.');
          }}
        />
      )}
      {!user && !parentId && !removed && (
        <Button title="Sign in to join the discussion" onPress={() => router.push('/login')} />
      )}
      {loading && !rows.length && <Muted>Loading replies…</Muted>}
      {!loading && !error && !rows.length && !parentId && (
        <Muted>No replies yet. Start the conversation.</Muted>
      )}
      {rows.map((reply) => (
        <View key={reply.id} style={styles.reply}>
          <Pressable
            disabled={!reply.author || reply.author.deleted}
            accessibilityRole="link"
            onPress={() => reply.author && router.push(`/users/${reply.author.username}`)}
          >
            <Text style={styles.author}>
              {reply.author?.display_name || reply.author?.username || 'Removed reply'}
            </Text>
          </Pressable>
          {reply.author_badge && <SupporterBadge />}
          <Text style={styles.body}>{reply.removed ? 'This reply was removed.' : reply.body}</Text>
          {user && !reply.removed && (
            <View style={styles.tools}>
              <LoungeLike
                path={`/api/v1/lounge/replies/${reply.id}/vote/`}
                liked={reply.liked}
                count={reply.likes}
              />
              <Button
                kind="secondary"
                title="Report"
                onPress={() => setReport({ lounge_reply_id: reply.id })}
              />
              {reply.can_delete && (
                <Button
                  kind="secondary"
                  title="Remove"
                  disabled={mutation.busy || loading}
                  onPress={() =>
                    confirmRemoval(
                      'Remove reply?',
                      () => void mutation.run(`/api/v1/lounge/replies/${reply.id}/`, 'DELETE'),
                    )
                  }
                />
              )}
            </View>
          )}
          {!parentId && (
            <Button
              kind="secondary"
              title={open === reply.id ? 'Hide thread' : `Replies (${reply.child_count})`}
              onPress={() => setOpen(open === reply.id ? null : reply.id)}
            />
          )}
          {open === reply.id && (
            <View style={styles.children}>
              <Thread
                key={reply.id}
                postId={postId}
                parentId={reply.id}
                removed={removed || reply.removed}
                onCountChange={(delta) => {
                  if (delta > 0)
                    setRows((current) =>
                      current.map((row) =>
                        row.id === reply.id
                          ? { ...row, child_count: row.child_count + delta }
                          : row,
                      ),
                    );
                  onCountChange?.(delta);
                }}
              />
            </View>
          )}
        </View>
      ))}
      <View style={styles.tools}>
        {page > 1 && (
          <Button
            kind="secondary"
            title="Previous replies"
            disabled={mutation.busy || loading}
            onPress={() => {
              setRows([]);
              setPage((value) => value - 1);
            }}
          />
        )}
        {next && (
          <Button
            kind="secondary"
            title="More replies"
            disabled={mutation.busy || loading}
            onPress={() => {
              setRows([]);
              setPage((value) => value + 1);
            }}
          />
        )}
      </View>
      <ErrorText>{error ?? mutation.error}</ErrorText>
      {error && (
        <Button
          kind="secondary"
          title="Retry replies"
          onPress={() => setVersion((value) => value + 1)}
        />
      )}
      {report && (
        <ReportSheet visible subject="reply" target={report} onClose={() => setReport(null)} />
      )}
    </View>
  );
}

export default function LoungeScreen() {
  return <LoungeView />;
}

export function LoungeView({ postId }: { postId?: string }) {
  const { width: viewportWidth } = useWindowDimensions();
  const styles = useStyles();
  const { user } = useAuth();
  const [feed, setFeed] = useState<LoungeFeed | null>(null);
  const [sort, setSort] = useState('new');
  const [timeWindow, setTimeWindow] = useState('week');
  const [page, setPage] = useState(1);
  const [version, setVersion] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [compose, setCompose] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [style, setStyle] = useState<LoungeStyle>('plain');
  const [selected, setSelected] = useState<OwnedCard[]>([]);
  const [cardQuery, setCardQuery] = useState('');
  const [cardsLoading, setCardsLoading] = useState(false);
  const [cardsError, setCardsError] = useState<string | null>(null);
  const [cardsRetry, setCardsRetry] = useState(0);
  const [cards, setCards] = useState<OwnedCard[]>([]);
  const [cardPage, setCardPage] = useState(1);
  const [cardsNext, setCardsNext] = useState(false);
  const [report, setReport] = useState<ReportTarget | null>(null);
  const [blocks, setBlocks] = useState<Creator[] | null>(null);
  const [inspect, setInspect] = useState<LoungeCard | null>(null);
  const blockRequest = useRef<AbortController | null>(null);
  const mutation = useMutation<LoungePost>((result, path, method) => {
    if (path === '/api/v1/lounge/') {
      setFeed((current) =>
        current
          ? { ...current, count: current.count + 1, results: [result, ...current.results] }
          : current,
      );
      if (sort !== 'new' || page !== 1) {
        setSort('new');
        setPage(1);
      }
    } else if (path.startsWith('/api/v1/lounge/posts/')) {
      const id = path.split('/').at(-2);
      setFeed((current) =>
        current
          ? {
              ...current,
              results: current.results.map((row) =>
                row.id === id
                  ? {
                      ...row,
                      removed: true,
                      title: 'Removed post',
                      body: '',
                      author: null,
                      author_badge: false,
                      cards: [],
                    }
                  : row,
              ),
            }
          : current,
      );
    } else if (method === 'POST') {
      const username = path.split('/').at(-2);
      const person = feed?.results.find((row) => row.author?.username === username)?.author;
      if (person)
        setBlocks((current) =>
          current ? [...current.filter((row) => row.username !== username), person] : current,
        );
      setFeed((current) =>
        current
          ? {
              ...current,
              results: current.results.filter((row) => row.author?.username !== username),
            }
          : current,
      );
    } else {
      const username = path.split('/').at(-2);
      setBlocks((current) => current?.filter((person) => person.username !== username) ?? null);
      setVersion((value) => value + 1);
    }
  });
  useEffect(() => {
    setCompose(false);
    setFeed(null);
    setTitle('');
    setBody('');
    setSelected([]);
    setCards([]);
    setCardQuery('');
    setCardsError(null);
    setStyle('plain');
    setAccepted(false);
    setCardPage(1);
    setReport(null);
    setBlocks(null);
    setInspect(null);
    return () => blockRequest.current?.abort();
  }, [user?.id]);
  useEffect(() => {
    const controller = new AbortController();
    setError(null);
    const request = postId
      ? apiFetch<LoungePost>(`/api/v1/lounge/posts/${postId}/`, { signal: controller.signal }).then(
          (post): LoungeFeed => ({
            enabled: true,
            subscriber: false,
            count: 1,
            next: null,
            previous: null,
            results: [post],
          }),
        )
      : apiFetch<LoungeFeed>(`/api/v1/lounge/?sort=${sort}&window=${timeWindow}&page=${page}`, {
          signal: controller.signal,
        });
    void request
      .then((data) => {
        if (!controller.signal.aborted) setFeed(data);
      })
      .catch((err: unknown) => {
        if (!controller.signal.aborted)
          setError(err instanceof Error ? err.message : 'Could not load the Lounge.');
      });
    return () => controller.abort();
  }, [sort, timeWindow, page, version, user?.id, postId]);
  useEffect(() => {
    if (!compose || !user) return;
    const controller = new AbortController();
    setCardsLoading(true);
    setCardsError(null);
    const timer = setTimeout(
      () => {
        void listMyCards(undefined, cardPage, {
          query: cardQuery.trim(),
          signal: controller.signal,
        })
          .then((data) => {
            if (!controller.signal.aborted) {
              setCards(data.results);
              setCardsNext(Boolean(data.next));
            }
          })
          .catch((err: unknown) => {
            if (!controller.signal.aborted)
              setCardsError(err instanceof Error ? err.message : 'Could not load cards.');
          })
          .finally(() => {
            if (!controller.signal.aborted) setCardsLoading(false);
          });
      },
      cardQuery ? 250 : 0,
    );
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [compose, cardPage, cardQuery, cardsRetry, user?.id]);
  const maxCards = feed?.subscriber ? 6 : 1;
  function renderPost({ item: post }: { item: LoungePost }) {
    const columns = Math.min(post.cards.length || 1, viewportWidth > 560 ? 3 : 2);
    const cardWidth = Math.min(200, (viewportWidth - 72 - 16 * (columns - 1)) / columns);
    return (
      <View style={postId ? styles.postPage : styles.panel}>
        <View style={styles.tools}>
          <Pressable
            disabled={!post.author || post.author.deleted}
            accessibilityRole="link"
            onPress={() => post.author && router.push(`/users/${post.author.username}`)}
          >
            <Text style={styles.author}>
              {post.author?.display_name || post.author?.username || 'Deleted collector'}
            </Text>
          </Pressable>
          {post.author_badge && <SupporterBadge />}
          <Muted>{new Date(post.created_at).toLocaleDateString()}</Muted>
        </View>
        {postId ? (
          <Text accessibilityRole="header" style={styles.postTitle}>
            {post.title}
          </Text>
        ) : (
          <Pressable accessibilityRole="link" onPress={() => router.push(`/lounge/${post.id}`)}>
            <Text style={styles.heading}>{post.title}</Text>
          </Pressable>
        )}
        <Text style={styles.body} numberOfLines={postId ? undefined : 3}>
          {post.body}
        </Text>
        {post.style === 'binder' && post.cards.length > 0 ? (
          <SharedSurface
            mode="lounge-showcase"
            data={{ cards: post.cards, style: post.style }}
            autoHeight
            onEvent={(type, id) => {
              if (type === 'inspect')
                setInspect(post.cards.find((card) => card?.id === id) ?? null);
            }}
          />
        ) : (
          post.cards.length > 0 && (
            <View style={[styles.cards, { width: columns * cardWidth + 16 * (columns - 1) }]}>
              {post.cards.map((card, index) =>
                card ? (
                  <Pressable
                    key={index}
                    accessibilityRole="button"
                    accessibilityLabel={`Inspect ${card.title}`}
                    onPress={() => setInspect(card)}
                  >
                    <CardPreview
                      width={cardWidth}
                      title={card.title}
                      rarity={card.rarity}
                      imageUrl={card.image?.url ?? null}
                      templateKey={card.template_key}
                      templateConfig={card.template_config}
                      code={cardCode(card.printed_set_code, card.position, card.set_total)}
                      printedText={card.printed_text}
                      render={card.render}
                    />
                  </Pressable>
                ) : (
                  <View
                    key={index}
                    style={[styles.missing, { width: cardWidth, height: cardWidth * 1.4 }]}
                  >
                    <Muted>Card no longer in this collection.</Muted>
                  </View>
                ),
              )}
            </View>
          )
        )}
        <View style={styles.tools}>
          {user && !post.removed && (
            <LoungeLike
              path={`/api/v1/lounge/posts/${post.id}/vote/`}
              liked={post.liked}
              count={post.likes}
            />
          )}
          {!postId && (
            <ActionChip
              icon="message-square"
              label="Replies"
              count={post.reply_count}
              onPress={() => router.push(`/lounge/${post.id}`)}
            />
          )}
          <ShareButton path={`/lounge/${post.id}`} title={post.title} />
          {user && !post.removed && (
            <MoreButton
              title={post.title}
              items={[
                {
                  label: 'Report post',
                  icon: 'flag',
                  onSelect: () => setReport({ lounge_post_id: post.id }),
                },
                ...(post.author &&
                !post.author.deleted &&
                post.author.username !== user.profile.username
                  ? [
                      {
                        label: 'Block in Lounge',
                        icon: 'slash' as const,
                        onSelect: () =>
                          Alert.alert(
                            `Block @${post.author!.username} in the Lounge?`,
                            'Hides each other’s Lounge posts and prevents replies and likes. Other app features are unchanged.',
                            [
                              { text: 'Cancel', style: 'cancel' },
                              {
                                text: 'Block',
                                style: 'destructive',
                                onPress: () =>
                                  void mutation.run(
                                    `/api/v1/me/lounge-blocks/${post.author!.username}/`,
                                    'POST',
                                  ),
                              },
                            ],
                          ),
                      },
                    ]
                  : []),
                ...(post.can_delete
                  ? [
                      {
                        label: 'Remove post',
                        icon: 'trash-2' as const,
                        onSelect: () =>
                          confirmRemoval(
                            'Remove post?',
                            () => void mutation.run(`/api/v1/lounge/posts/${post.id}/`, 'DELETE'),
                          ),
                      },
                    ]
                  : []),
              ]}
            />
          )}
        </View>
        {postId && (
          <View style={styles.discussion}>
            <View style={styles.discussionHead}>
              <Text accessibilityRole="header" style={styles.heading}>
                Discussion
              </Text>
              <Muted>
                {post.reply_count} {post.reply_count === 1 ? 'reply' : 'replies'}
              </Muted>
            </View>
            <Thread
              postId={post.id}
              removed={post.removed}
              onCountChange={(delta) =>
                setFeed((current) =>
                  current
                    ? {
                        ...current,
                        results: current.results.map((row) =>
                          row.id === post.id
                            ? { ...row, reply_count: Math.max(0, row.reply_count + delta) }
                            : row,
                        ),
                      }
                    : current,
                )
              }
            />
          </View>
        )}
      </View>
    );
  }
  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: postId ? 'Discussion' : 'Lounge' }} />
      <FlatList
        data={feed?.results ?? []}
        keyExtractor={(post) => post.id}
        renderItem={renderPost}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          postId ? (
            <View style={styles.thread}>
              <ErrorText>{error ?? mutation.error}</ErrorText>
              {!feed && (
                <Muted>{error ? 'This discussion could not load.' : 'Loading discussion…'}</Muted>
              )}
              {error && (
                <Button
                  kind="secondary"
                  title="Retry discussion"
                  onPress={() => setVersion((value) => value + 1)}
                />
              )}
            </View>
          ) : (
            <View style={styles.thread}>
              <Text style={styles.heading}>
                Talk collections, share your cards, and discuss trading.
              </Text>
              <ErrorText>{error ?? mutation.error}</ErrorText>
              <Button
                kind="secondary"
                title="Refresh Lounge"
                onPress={() => setVersion((value) => value + 1)}
              />
              {!feed ? (
                <Muted>{error ? 'The Lounge could not load.' : 'Loading the Lounge…'}</Muted>
              ) : !feed.enabled ? (
                <Muted>The Lounge is not open yet.</Muted>
              ) : (
                <>
                  <View style={styles.tools}>
                    {['new', 'top', 'active'].map((value) => (
                      <Chip
                        key={value}
                        label={value.charAt(0).toUpperCase() + value.slice(1)}
                        active={sort === value}
                        onPress={() => {
                          setSort(value);
                          setPage(1);
                        }}
                      />
                    ))}
                  </View>
                  {sort === 'top' && (
                    <View style={styles.tools}>
                      {[
                        ['today', 'Today'],
                        ['week', 'Week'],
                        ['month', 'Month'],
                        ['all', 'All time'],
                      ].map(([value, label]) => (
                        <Chip
                          key={value!}
                          label={label!}
                          active={timeWindow === value}
                          onPress={() => {
                            setTimeWindow(value!);
                            setPage(1);
                          }}
                        />
                      ))}
                    </View>
                  )}
                  {user ? (
                    <>
                      <Button
                        title={compose ? 'Close composer' : 'Start a discussion'}
                        onPress={() => setCompose(!compose)}
                      />
                      <Button
                        kind="secondary"
                        title="Blocked collectors"
                        onPress={() => {
                          const controller = new AbortController();
                          blockRequest.current?.abort();
                          blockRequest.current = controller;
                          void apiFetch<Creator[]>('/api/v1/me/lounge-blocks/', {
                            signal: controller.signal,
                          })
                            .then((data) => {
                              if (!controller.signal.aborted) setBlocks(data);
                            })
                            .catch((err: Error) => {
                              if (!controller.signal.aborted) setError(err.message);
                            });
                        }}
                      />
                    </>
                  ) : (
                    <Button title="Sign in to join in" onPress={() => router.push('/login')} />
                  )}
                  {blocks && (
                    <View style={styles.panel}>
                      <Muted>Blocked in the Lounge. Other app features are unchanged.</Muted>
                      {!blocks.length && <Muted>Nobody blocked.</Muted>}
                      {blocks.map((person) => (
                        <Button
                          key={person.username}
                          kind="secondary"
                          title={`Unblock @${person.username}`}
                          disabled={mutation.busy}
                          onPress={() =>
                            void mutation.run(
                              `/api/v1/me/lounge-blocks/${person.username}/`,
                              'DELETE',
                            )
                          }
                        />
                      ))}
                      <Button
                        kind="secondary"
                        title="Close blocked list"
                        onPress={() => setBlocks(null)}
                      />
                    </View>
                  )}
                  {compose && (
                    <View style={styles.panel}>
                      <Input
                        accessibilityLabel="Discussion title"
                        placeholder="Discussion title"
                        maxLength={120}
                        value={title}
                        onChangeText={setTitle}
                      />
                      <Input
                        accessibilityLabel="Your post"
                        placeholder="Your post"
                        multiline
                        maxLength={3000}
                        value={body}
                        onChangeText={setBody}
                      />
                      <Muted>
                        Optional: choose up to {maxCards} {maxCards === 1 ? 'card' : 'cards'}.
                      </Muted>
                      <FilterField
                        value={cardQuery}
                        onChange={(value) => {
                          setCardQuery(value);
                          setCardPage(1);
                        }}
                        placeholder="Find a card or set"
                        label="Find a card in your collection"
                      />
                      {selected.length > 0 && (
                        <View style={styles.tools}>
                          {selected.map((owned) => (
                            <ActionChip
                              key={owned.id}
                              icon="x"
                              label={owned.card.title}
                              accessibilityLabel={`Remove ${owned.card.title} from showcase`}
                              onPress={() =>
                                setSelected((current) =>
                                  current.filter((copy) => copy.id !== owned.id),
                                )
                              }
                            />
                          ))}
                        </View>
                      )}
                      {cardsLoading && <Muted>Loading cards…</Muted>}
                      <ErrorText>{cardsError}</ErrorText>
                      {cardsError && (
                        <Button
                          title="Retry cards"
                          kind="secondary"
                          onPress={() => setCardsRetry((value) => value + 1)}
                        />
                      )}
                      {!cardsLoading && !cardsError && !cards.length && (
                        <Muted>
                          {cardQuery
                            ? 'No cards match that search.'
                            : 'Open a pack to start your collection, or post without a card.'}
                        </Muted>
                      )}
                      <ScrollView
                        style={styles.picker}
                        nestedScrollEnabled
                        keyboardShouldPersistTaps="handled"
                      >
                        {cards.map((owned) => (
                          <View key={owned.id} style={styles.choice}>
                            <Switch
                              accessibilityLabel={`Include ${owned.card.title}`}
                              value={selected.some((copy) => copy.id === owned.id)}
                              disabled={
                                cardsLoading ||
                                !!cardsError ||
                                (!selected.some((copy) => copy.id === owned.id) &&
                                  selected.length >= maxCards)
                              }
                              onValueChange={() =>
                                setSelected((values) =>
                                  values.some((copy) => copy.id === owned.id)
                                    ? values.filter((copy) => copy.id !== owned.id)
                                    : [...values, owned],
                                )
                              }
                            />
                            <CardPreview
                              width={64}
                              title={owned.card.title}
                              rarity={owned.card.rarity}
                              imageUrl={owned.card.image?.url ?? null}
                              templateKey={owned.card.template_key}
                              templateConfig={owned.card.template_config}
                              code={cardCode(
                                owned.card.printed_set_code,
                                owned.card.position,
                                owned.card.set_total,
                              )}
                              printedText={owned.card.printed_text}
                              render={owned.card.render}
                            />
                            <Text style={[styles.body, styles.choiceText]}>
                              {owned.card.title} · {owned.set_title}
                            </Text>
                          </View>
                        ))}
                      </ScrollView>
                      <View style={styles.tools}>
                        {cardPage > 1 && (
                          <Button
                            kind="secondary"
                            title="Previous cards"
                            disabled={cardsLoading}
                            onPress={() => setCardPage((value) => value - 1)}
                          />
                        )}
                        {cardsNext && (
                          <Button
                            kind="secondary"
                            title="More cards"
                            disabled={cardsLoading}
                            onPress={() => setCardPage((value) => value + 1)}
                          />
                        )}
                        {selected.length > 0 && (
                          <Button
                            kind="secondary"
                            title={`Clear ${selected.length} selected`}
                            onPress={() => setSelected([])}
                          />
                        )}
                      </View>
                      {feed.subscriber && (
                        <View style={styles.tools}>
                          {(['plain', 'binder'] as const).map((value) => (
                            <Chip
                              key={value}
                              label={value === 'plain' ? 'Cards' : 'Binder'}
                              active={style === value}
                              onPress={() => setStyle(value)}
                            />
                          ))}
                        </View>
                      )}
                      <Muted>{RULES}</Muted>
                      <View style={styles.choice}>
                        <Switch
                          accessibilityLabel="Agree to Lounge rules"
                          value={accepted}
                          onValueChange={setAccepted}
                        />
                        <Text style={[styles.body, styles.choiceText]}>
                          I agree to the Lounge rules.
                        </Text>
                      </View>
                      <Button
                        title="Post discussion"
                        disabled={mutation.busy || !accepted || !title.trim() || !body.trim()}
                        onPress={() =>
                          void mutation
                            .run('/api/v1/lounge/', 'POST', {
                              title,
                              body,
                              rules_accepted: accepted,
                              card_ids: selected.map((card) => card.id),
                              style: feed.subscriber ? style : 'plain',
                            })
                            .then((done) => {
                              if (done) {
                                setCompose(false);
                                setTitle('');
                                setBody('');
                                setSelected([]);
                                setAccepted(false);
                                setPage(1);
                              }
                            })
                        }
                      />
                    </View>
                  )}
                  {!feed.results.length && (
                    <Muted>No discussions here yet. Start one about your collection.</Muted>
                  )}
                </>
              )}
            </View>
          )
        }
        ListFooterComponent={
          postId ? null : (
            <View style={styles.tools}>
              {page > 1 && (
                <Button
                  kind="secondary"
                  title="Previous posts"
                  onPress={() => setPage((value) => value - 1)}
                />
              )}
              {feed?.next && (
                <Button
                  kind="secondary"
                  title="More posts"
                  onPress={() => setPage((value) => value + 1)}
                />
              )}
            </View>
          )
        }
      />
      {report && (
        <ReportSheet visible subject="post" target={report} onClose={() => setReport(null)} />
      )}
      <InspectorModal open={inspect !== null} onClose={() => setInspect(null)}>
        {inspect && (
          <CardInspector
            card={inspect}
            setTitle={inspect.set_title}
            setSlug={inspect.set_slug}
            mark={inspect.set_mark}
            packColour={inspect.set_pack_colour}
            creator={inspect.set_creator}
            onClose={() => setInspect(null)}
          />
        )}
      </InspectorModal>
    </View>
  );
}

const useStyles = createThemedStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 20, gap: 16, paddingBottom: 40 },
  panel: {
    backgroundColor: colors.sur,
    borderColor: colors.bdr,
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
    gap: 12,
  },
  heading: { color: colors.text, fontFamily: fonts.medium, fontSize: 22 },
  postPage: { padding: 16, gap: 18, backgroundColor: colors.sur },
  postTitle: { color: colors.text, fontFamily: fonts.display, fontSize: 34 },
  discussion: {
    marginTop: 12,
    paddingTop: 20,
    borderTopWidth: 1,
    borderColor: colors.bdr,
    gap: 16,
  },
  discussionHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 12,
  },
  author: { color: colors.text, fontFamily: fonts.medium, fontSize: 15 },
  body: { color: colors.text, fontFamily: fonts.body, fontSize: 16, lineHeight: 23 },
  tools: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cards: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignSelf: 'center',
    gap: 16,
    paddingVertical: 8,
  },
  missing: { padding: 8, justifyContent: 'center', backgroundColor: colors.sur2, borderRadius: 4 },
  thread: { gap: 12 },
  reply: { borderTopWidth: 1, borderColor: colors.bdr, paddingTop: 12, gap: 8 },
  children: { marginLeft: 12, paddingLeft: 12, borderLeftWidth: 2, borderColor: colors.bdr },
  picker: { maxHeight: 250 },
  choice: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  choiceText: { flex: 1 },
}));

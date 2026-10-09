'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import type {
  Creator,
  LoungeFeed,
  LoungeCard,
  LoungePostWrite,
  LoungePost,
  LoungeStyle,
  OwnedCard,
} from '@miscellary/shared';
import { cardCode } from '@miscellary/shared';
import PageHeader from '@/components/PageHeader';
import SearchField from '@/components/SearchField';
import { listMyCards } from '@/lib/packs';
import CardPreview from '@/components/CardPreview';
import LoungeThread from '@/components/LoungeThread';
import Sheet, { Empty } from '@/components/Sheet';
import LikeButton from '@/components/LikeButton';
import PersonLink from '@/components/PersonLink';
import ShareButton from '@/components/ShareButton';
import MoreMenu from '@/components/MoreMenu';
import SupporterBadge from '@/components/SupporterBadge';
import CardInspector from '@/components/CardInspector';
import LoungeShowcase from '@/components/LoungeShowcase';
import { Monogram } from '@/components/Comments';
import commentStyles from '@/components/Comments.module.css';
import { timeAgo } from '@/lib/time';
import ReportDialog from '@/components/ReportDialog';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import ui from '@/components/ui.module.css';
import styles from './page.module.css';

export default function LoungeView({ postId }: { postId?: string }) {
  const { user } = useAuth();
  const [feed, setFeed] = useState<LoungeFeed | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [sort, setSort] = useState('new');
  const [timeWindow, setTimeWindow] = useState('week');
  const [page, setPage] = useState(1);
  const [version, setVersion] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [compose, setCompose] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [style, setStyle] = useState<LoungeStyle>('plain');
  const [accepted, setAccepted] = useState(false);
  const [selected, setSelected] = useState<OwnedCard[]>([]);
  const [cardQuery, setCardQuery] = useState('');
  const [cardsLoading, setCardsLoading] = useState(false);
  const [cardsError, setCardsError] = useState<string | null>(null);
  const [cardsRetry, setCardsRetry] = useState(0);
  const [cards, setCards] = useState<OwnedCard[]>([]);
  const [cardPage, setCardPage] = useState(1);
  const [cardsNext, setCardsNext] = useState(false);
  const [report, setReport] = useState<string | null>(null);
  const [blocks, setBlocks] = useState<Creator[] | null>(null);
  const [inspect, setInspect] = useState<LoungeCard | null>(null);
  const [confirm, setConfirm] = useState<{ id: string; kind: 'block' | 'remove' } | null>(null);
  const mutation = useRef<AbortController | null>(null);
  const blockRequest = useRef<AbortController | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    setRefreshing(true);
    const request = postId
      ? apiFetch<LoungePost>(`/api/v1/lounge/posts/${postId}/`, { signal: controller.signal }).then(
          (post) => ({
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
        if (!controller.signal.aborted) {
          setFeed(data);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (!controller.signal.aborted)
          setError(err instanceof Error ? err.message : 'Could not load the Lounge.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setRefreshing(false);
      });
    return () => controller.abort();
  }, [sort, timeWindow, page, version, user?.id, postId]);
  useEffect(() => {
    setFeed(null);
    setCompose(false);
    setSelected([]);
    setCards([]);
    setCardQuery('');
    setCardsError(null);
    setTitle('');
    setBody('');
    setBlocks(null);
    setStyle('plain');
    setAccepted(false);
    setCardPage(1);
    setReport(null);
    setInspect(null);
    setConfirm(null);
    setBusy(false);
    return () => {
      mutation.current?.abort();
      mutation.current = null;
      blockRequest.current?.abort();
    };
  }, [user?.id]);
  useEffect(() => {
    if (!compose || !user) return;
    const controller = new AbortController();
    setCardsLoading(true);
    setCardsError(null);
    const timer = window.setTimeout(
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
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [compose, cardPage, cardQuery, cardsRetry, user?.id]);
  async function mutate(path: string, method: string, data?: LoungePostWrite) {
    if (mutation.current) return;
    const controller = new AbortController();
    mutation.current = controller;
    setBusy(true);
    setError(null);
    try {
      const result = await apiFetch<LoungePost>(path, {
        method,
        signal: controller.signal,
        ...(data ? { body: data } : {}),
      });
      if (controller.signal.aborted) return;
      setConfirm(null);
      if (data) {
        if (page === 1 && sort === 'new')
          setFeed((current) =>
            current
              ? { ...current, count: current.count + 1, results: [result, ...current.results] }
              : current,
          );
        else {
          setSort('new');
          setPage(1);
          setVersion((value) => value + 1);
        }
        setCompose(false);
        setTitle('');
        setBody('');
        setSelected([]);
        setAccepted(false);
        setPage(1);
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
        setFeed((current) =>
          current
            ? {
                ...current,
                results: current.results.filter((row) => row.author?.username !== username),
              }
            : current,
        );
      } else {
        setVersion((value) => value + 1);
      }
      if (blocks && path.startsWith('/api/v1/me/lounge-blocks/')) {
        const updated = await apiFetch<Creator[]>('/api/v1/me/lounge-blocks/', {
          signal: controller.signal,
        });
        if (!controller.signal.aborted) setBlocks(updated);
      }
    } catch (err: unknown) {
      if (!controller.signal.aborted)
        setError(err instanceof Error ? err.message : 'Could not update the Lounge.');
    } finally {
      if (mutation.current === controller) {
        mutation.current = null;
        setBusy(false);
      }
    }
  }
  const maxCards = feed?.subscriber ? 6 : 1;
  return (
    <section className={styles.page} aria-busy={refreshing}>
      {postId ? (
        <nav aria-label="Lounge navigation">
          <Link href="/lounge" className={styles.back}>
            <span aria-hidden="true">←</span> Lounge
          </Link>
        </nav>
      ) : (
        <PageHeader
          title="Lounge"
          description="Talk collections, share your cards, and discuss trading."
        />
      )}
      {error && (
        <p role="alert" className={ui.error}>
          {error}
        </p>
      )}
      {!feed ? (
        error ? (
          <button
            type="button"
            className={ui.btnQuiet}
            onClick={() => setVersion((value) => value + 1)}
          >
            Retry Lounge
          </button>
        ) : (
          <p className={ui.muted}>Loading the Lounge…</p>
        )
      ) : !feed.enabled ? (
        <p className={ui.muted}>The Lounge is not open yet.</p>
      ) : (
        <>
          {!postId && (
            <div className={styles.toolbar}>
              <div className={styles.tools} role="group" aria-label="Sort Lounge">
                {['new', 'top', 'active'].map((value) => (
                  <button
                    key={value}
                    type="button"
                    className={`${ui.action} ${sort === value ? ui.actionOn : ''}`}
                    aria-pressed={sort === value}
                    onClick={() => {
                      setSort(value);
                      setPage(1);
                    }}
                  >
                    {value.charAt(0).toUpperCase() + value.slice(1)}
                  </button>
                ))}
              </div>
              {sort === 'top' && (
                <label>
                  From{' '}
                  <select
                    aria-label="Top time window"
                    className={ui.input}
                    value={timeWindow}
                    onChange={(event) => {
                      setTimeWindow(event.target.value);
                      setPage(1);
                    }}
                  >
                    <option value="today">Today</option>
                    <option value="week">This week</option>
                    <option value="month">This month</option>
                    <option value="all">All time</option>
                  </select>
                </label>
              )}
              {user ? (
                <>
                  <div className={styles.tools}>
                    <button
                      type="button"
                      className={ui.btnPrimary}
                      onClick={() => setCompose(!compose)}
                    >
                      {compose ? 'Close composer' : 'Start a discussion'}
                    </button>
                    <MoreMenu
                      label="Lounge options"
                      items={[
                        { label: 'Membership', href: '/account?section=account' },
                        {
                          label: 'Blocked collectors',
                          onSelect: () => {
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
                          },
                        },
                      ]}
                    />
                  </div>
                </>
              ) : (
                <Link href="/login?next=%2Flounge" className={ui.btnQuiet}>
                  Sign in to join in
                </Link>
              )}
            </div>
          )}
          {blocks && (
            <Sheet title="Blocked in the Lounge" className={styles.panel}>
              <p className={ui.muted}>
                Blocking hides each other’s Lounge posts and prevents replies and likes between you.
                Other app features are unchanged.
              </p>
              {blocks.length === 0 && <p>Nobody blocked.</p>}
              {blocks.map((person) => (
                <div key={person.username} className={styles.tools}>
                  <PersonLink person={person}>@{person.username}</PersonLink>
                  <button
                    type="button"
                    className={ui.btnQuiet}
                    disabled={busy}
                    onClick={() =>
                      void mutate(`/api/v1/me/lounge-blocks/${person.username}/`, 'DELETE')
                    }
                  >
                    Unblock
                  </button>
                </div>
              ))}
              <button type="button" className={ui.btnQuiet} onClick={() => setBlocks(null)}>
                Close blocked list
              </button>
            </Sheet>
          )}
          {compose && (
            <Sheet title="Start a discussion">
              <form
                className={styles.composer}
                onSubmit={(event) => {
                  event.preventDefault();
                  void mutate('/api/v1/lounge/', 'POST', {
                    title,
                    body,
                    style: feed.subscriber ? style : 'plain',
                    card_ids: selected.map((card) => card.id),
                    rules_accepted: accepted,
                  });
                }}
              >
                <label className={styles.field}>
                  <span className={ui.label}>Discussion title</span>
                  <input
                    className={ui.input}
                    maxLength={120}
                    required
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                  />
                </label>
                <label className={styles.field}>
                  <span className={ui.label}>Your post</span>
                  <textarea
                    className={ui.input}
                    rows={4}
                    maxLength={3000}
                    required
                    value={body}
                    onChange={(event) => setBody(event.target.value)}
                  />
                </label>
                <p className={ui.muted}>
                  Optional: choose up to {maxCards} {maxCards === 1 ? 'card' : 'cards'} from your
                  collection.
                </p>
                <SearchField
                  value={cardQuery}
                  onChange={(value) => {
                    setCardQuery(value);
                    setCardPage(1);
                  }}
                  label="Find a card in your collection"
                  placeholder="Find a card or set"
                />
                {selected.length > 0 && (
                  <div className={styles.selected} aria-label="Selected cards">
                    {selected.map((owned) => (
                      <button
                        key={owned.id}
                        type="button"
                        className={ui.action}
                        onClick={() =>
                          setSelected((current) => current.filter((copy) => copy.id !== owned.id))
                        }
                        aria-label={`Remove ${owned.card.title} from showcase`}
                      >
                        {owned.card.title}
                        <span aria-hidden="true">×</span>
                      </button>
                    ))}
                  </div>
                )}
                {cardsLoading && (
                  <p role="status" className={ui.muted}>
                    Loading cards…
                  </p>
                )}
                {cardsError && (
                  <div>
                    <p role="alert" className={ui.error}>
                      {cardsError}
                    </p>
                    <button
                      type="button"
                      className={ui.btnQuiet}
                      onClick={() => setCardsRetry((value) => value + 1)}
                    >
                      Retry cards
                    </button>
                  </div>
                )}
                {!cardsLoading && !cardsError && !cards.length && (
                  <p className={ui.muted}>
                    {cardQuery
                      ? 'No cards match that search.'
                      : 'Open a pack to start your collection, or post without a card.'}
                  </p>
                )}
                <div className={styles.picker} aria-busy={cardsLoading}>
                  {cards.map((owned) => (
                    <label key={owned.id} className={styles.check}>
                      <input
                        type="checkbox"
                        checked={selected.some((copy) => copy.id === owned.id)}
                        disabled={
                          cardsLoading ||
                          !!cardsError ||
                          (!selected.some((copy) => copy.id === owned.id) &&
                            selected.length >= maxCards)
                        }
                        onChange={() =>
                          setSelected((values) =>
                            values.some((copy) => copy.id === owned.id)
                              ? values.filter((copy) => copy.id !== owned.id)
                              : [...values, owned],
                          )
                        }
                      />
                      <CardPreview
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
                        previewThumbnail
                        renderMode="flat"
                      />
                      <span>
                        <b>{owned.card.title}</b>
                        <small>{owned.set_title}</small>
                      </span>
                    </label>
                  ))}
                </div>
                <div className={styles.tools}>
                  {cardPage > 1 && (
                    <button
                      type="button"
                      className={ui.btnQuiet}
                      disabled={cardsLoading}
                      onClick={() => setCardPage((value) => value - 1)}
                    >
                      Previous cards
                    </button>
                  )}
                  {cardsNext && (
                    <button
                      type="button"
                      className={ui.btnQuiet}
                      disabled={cardsLoading}
                      onClick={() => setCardPage((value) => value + 1)}
                    >
                      More cards
                    </button>
                  )}
                </div>
                {selected.length > 0 && (
                  <p className={ui.muted}>
                    {selected.length} selected{' '}
                    <button type="button" className={ui.btnQuiet} onClick={() => setSelected([])}>
                      Clear cards
                    </button>
                  </p>
                )}
                {feed.subscriber && (
                  <label className={styles.field}>
                    <span className={ui.label}>Card layout</span>
                    <select
                      className={ui.input}
                      value={style}
                      onChange={(event) => setStyle(event.target.value as LoungeStyle)}
                    >
                      <option value="plain">Cards</option>
                      <option value="binder">Binder</option>
                    </select>
                  </label>
                )}
                <p className={styles.rules}>
                  Keep it kind and collection-related. No harassment, adult content, spam or stolen
                  work. Share only cards you own; report problems for a moderator to review.
                  Supporters follow the same rules.
                </p>
                <label className={styles.check}>
                  <input
                    type="checkbox"
                    checked={accepted}
                    onChange={(event) => setAccepted(event.target.checked)}
                  />
                  I agree to the Lounge rules.
                </label>
                <button
                  className={ui.btnPrimary}
                  disabled={busy || !accepted || !title.trim() || !body.trim()}
                >
                  Post discussion
                </button>
              </form>
            </Sheet>
          )}
          {feed.results.length === 0 && (
            <Sheet>
              <Empty>
                {postId
                  ? 'This discussion is no longer available.'
                  : 'No discussions here yet. Start one about your collection.'}
              </Empty>
            </Sheet>
          )}
          {feed.results.map((post) => (
            <Sheet key={post.id} className={postId ? styles.discussion : styles.post}>
              <article className={styles.postContent}>
                <div className={styles.byline}>
                  <Monogram name={post.author?.display_name || post.author?.username || '?'} />
                  {post.author ? (
                    <PersonLink person={post.author} className={commentStyles.name}>
                      {post.author.display_name || post.author.username}
                    </PersonLink>
                  ) : (
                    <span className={ui.muted}>Deleted collector</span>
                  )}
                  {post.author_badge && <SupporterBadge />}
                  <time
                    dateTime={post.created_at}
                    title={new Date(post.created_at).toLocaleString()}
                    className={styles.when}
                  >
                    {timeAgo(post.created_at)}
                  </time>
                </div>
                {postId ? (
                  <h1 className={styles.postTitle}>{post.title}</h1>
                ) : (
                  <h2>
                    <Link href={`/lounge/${post.id}`}>{post.title}</Link>
                  </h2>
                )}
                <p className={`${styles.body} ${postId ? '' : styles.excerpt}`}>{post.body}</p>
                {post.cards.length > 0 && (
                  <LoungeShowcase cards={post.cards} style={post.style} onInspect={setInspect} />
                )}
                <div className={styles.tools}>
                  {!post.removed && (
                    <LikeButton
                      chip
                      liked={post.liked}
                      count={post.likes}
                      label={post.title}
                      onToggle={async (liked) => {
                        const result = await apiFetch<{ liked: boolean; likes: number }>(
                          `/api/v1/lounge/posts/${post.id}/vote/`,
                          { method: liked ? 'POST' : 'DELETE' },
                        );
                        setFeed((current) =>
                          current
                            ? {
                                ...current,
                                results: current.results.map((row) =>
                                  row.id === post.id
                                    ? { ...row, liked: result.liked, likes: result.likes }
                                    : row,
                                ),
                              }
                            : current,
                        );
                        return { liked: result.liked, like_count: result.likes };
                      }}
                    />
                  )}
                  <Link
                    className={ui.action}
                    href={postId ? '#discussion' : `/lounge/${post.id}#discussion`}
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M4 4h16v12H9l-5 4Z" />
                    </svg>
                    {post.reply_count} {post.reply_count === 1 ? 'reply' : 'replies'}
                  </Link>
                  <ShareButton path={`/lounge/${post.id}`} title={post.title} />
                  {user && !post.removed && (
                    <MoreMenu
                      label={`More options for ${post.title}`}
                      items={[
                        { label: 'Report post', onSelect: () => setReport(post.id) },
                        ...(post.author &&
                        !post.author.deleted &&
                        post.author.username !== user.profile.username
                          ? [
                              {
                                label: 'Block in Lounge',
                                onSelect: () => setConfirm({ id: post.id, kind: 'block' }),
                                danger: true,
                              },
                            ]
                          : []),
                        ...(post.can_delete
                          ? [
                              {
                                label: 'Remove post',
                                onSelect: () => setConfirm({ id: post.id, kind: 'remove' }),
                                danger: true,
                              },
                            ]
                          : []),
                      ]}
                    />
                  )}
                </div>
                {confirm?.id === post.id && (
                  <div className={styles.confirmation}>
                    <p>
                      {confirm.kind === 'remove'
                        ? 'Remove this post? Replies will keep their place.'
                        : `Block @${post.author?.username}? You won't see each other's Lounge posts or be able to reply or like. Other app features stay unchanged.`}
                    </p>
                    <div className={styles.tools}>
                      <button
                        type="button"
                        className={ui.btnQuiet}
                        disabled={busy}
                        onClick={() => setConfirm(null)}
                      >
                        Keep browsing
                      </button>
                      <button
                        type="button"
                        className={ui.btnOutline}
                        disabled={busy}
                        onClick={() =>
                          void mutate(
                            confirm.kind === 'remove'
                              ? `/api/v1/lounge/posts/${post.id}/`
                              : `/api/v1/me/lounge-blocks/${post.author!.username}/`,
                            confirm.kind === 'remove' ? 'DELETE' : 'POST',
                          )
                        }
                      >
                        {confirm.kind === 'remove' ? 'Remove post' : 'Block collector'}
                      </button>
                    </div>
                  </div>
                )}
              </article>
              {postId && (
                <section
                  id="discussion"
                  aria-labelledby="discussion-title"
                  className={styles.discussionReplies}
                >
                  <header className={styles.discussionHead}>
                    <h2 id="discussion-title">Discussion</h2>
                    <span className={ui.muted}>
                      {post.reply_count} {post.reply_count === 1 ? 'reply' : 'replies'}
                    </span>
                  </header>
                  <LoungeThread
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
                </section>
              )}
            </Sheet>
          ))}
          <div className={styles.tools}>
            {page > 1 && (
              <button
                type="button"
                className={ui.btnQuiet}
                onClick={() => setPage((value) => value - 1)}
              >
                Previous posts
              </button>
            )}
            {feed.next && (
              <button
                type="button"
                className={ui.btnQuiet}
                onClick={() => setPage((value) => value + 1)}
              >
                More posts
              </button>
            )}
          </div>
        </>
      )}
      {report && (
        <ReportDialog
          target={{ lounge_post_id: report }}
          subject="post"
          onClose={() => setReport(null)}
        />
      )}
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
    </section>
  );
}

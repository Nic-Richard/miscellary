'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import type { LoungeCard, LoungePost } from '@miscellary/shared';
import { loungeTopicLabel } from '@miscellary/shared';
import Avatar from '@/components/Avatar';
import CardInspector from '@/components/CardInspector';
import LikeButton from '@/components/LikeButton';
import LoungeShowcase from '@/components/LoungeShowcase';
import MoreMenu from '@/components/MoreMenu';
import PersonLink from '@/components/PersonLink';
import ReportDialog from '@/components/ReportDialog';
import ShareButton from '@/components/ShareButton';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { timeAgo } from '@/lib/time';
import ui from '@/components/ui.module.css';
import { useLounge } from './LoungeShell';
import LoungeThread from './LoungeThread';
import styles from './Lounge.module.css';

const REMOVED = {
  removed: true,
  title: 'Removed post',
  body: '',
  author: null,
  author_badge: false,
  cards: [],
};

export default function Discussion({ postId }: { postId: string }) {
  const { user } = useAuth();
  const { patchPost, hideAuthor } = useLounge();
  const [post, setPost] = useState<LoungePost | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<'block' | 'remove' | null>(null);
  const [report, setReport] = useState(false);
  const [inspect, setInspect] = useState<LoungeCard | null>(null);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    setPost(null);
    setError(null);
    setConfirm(null);
    scroller.current?.scrollTo({ top: 0 });
    void apiFetch<LoungePost>(`/api/v1/lounge/posts/${postId}/`, { signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted) setPost(data);
      })
      .catch((err: unknown) => {
        if (!controller.signal.aborted)
          setError(err instanceof Error ? err.message : 'Could not load this discussion.');
      });
    return () => controller.abort();
  }, [postId, version, user?.id]);

  function update(patch: Partial<LoungePost>) {
    setPost((current) => (current ? { ...current, ...patch } : current));
    patchPost(postId, patch);
  }

  async function act(kind: 'block' | 'remove') {
    if (!post || busy) return;
    setBusy(true);
    setError(null);
    try {
      if (kind === 'remove') {
        await apiFetch(`/api/v1/lounge/posts/${post.id}/`, { method: 'DELETE' });
        update(REMOVED);
      } else if (post.author) {
        await apiFetch(`/api/v1/me/lounge-blocks/${post.author.username}/`, { method: 'POST' });
        hideAuthor(post.author.username);
        setVersion((value) => value + 1);
      }
      setConfirm(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not update the Lounge.');
    } finally {
      setBusy(false);
    }
  }

  const back = (
    <Link href="/lounge" className={styles.back}>
      <span aria-hidden="true">←</span> All discussions
    </Link>
  );

  if (!post)
    return (
      <div className={styles.paneScroll}>
        <div className={styles.head}>
          {back}
          {error ? (
            <>
              <p role="alert" className={ui.error}>
                {error}
              </p>
              <button
                type="button"
                className={ui.btnQuiet}
                onClick={() => setVersion((value) => value + 1)}
              >
                Try again
              </button>
            </>
          ) : (
            <p role="status" className={ui.muted}>
              Loading discussion…
            </p>
          )}
        </div>
      </div>
    );

  const own = post.author?.username === user?.profile.username;
  return (
    <>
      <div className={styles.paneScroll} ref={scroller}>
        <header className={styles.head}>
          {back}
          <span className={styles.topic}>{loungeTopicLabel(post.topic)}</span>
          <h1 className={styles.title}>{post.title}</h1>
          <div className={styles.meta}>
            {post.author ? (
              <PersonLink person={post.author} className={styles.who}>
                <Avatar person={post.author} supporter={post.author_badge} size={24} />
                {post.author.display_name || post.author.username}
              </PersonLink>
            ) : (
              <span className={styles.who}>Deleted collector</span>
            )}
            <time dateTime={post.created_at} title={new Date(post.created_at).toLocaleString()}>
              Started {timeAgo(post.created_at)}
            </time>
            <span>
              {post.reply_count} {post.reply_count === 1 ? 'reply' : 'replies'}
            </span>
          </div>
        </header>
        <article className={styles.post}>
          {post.removed ? (
            <p className={ui.muted}>This post was removed. Replies keep their place.</p>
          ) : (
            <p className={styles.body}>{post.body}</p>
          )}
          {post.cards.length > 0 && (
            <LoungeShowcase cards={post.cards} style={post.style} onInspect={setInspect} compact />
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
                  update({ liked: result.liked, likes: result.likes });
                  return { liked: result.liked, like_count: result.likes };
                }}
              />
            )}
            <ShareButton path={`/lounge/${post.id}`} title={post.title} />
            {user && !post.removed && (
              <MoreMenu
                label={`More options for ${post.title}`}
                items={[
                  ...(!own ? [{ label: 'Report post', onSelect: () => setReport(true) }] : []),
                  ...(post.author && !post.author.deleted && !own
                    ? [
                        {
                          label: 'Block in Lounge',
                          onSelect: () => setConfirm('block'),
                          danger: true,
                        },
                      ]
                    : []),
                  ...(post.can_delete
                    ? [{ label: 'Remove post', onSelect: () => setConfirm('remove'), danger: true }]
                    : []),
                ]}
              />
            )}
          </div>
          {error && (
            <p role="alert" className={ui.error}>
              {error}
            </p>
          )}
          {confirm && (
            <div className={styles.confirmation}>
              <p>
                {confirm === 'remove'
                  ? 'Remove this post? Replies keep their place.'
                  : `Block @${post.author?.username}? You won't see each other's Lounge posts, replies or likes. Other app features stay the same.`}
              </p>
              <div className={styles.tools}>
                <button
                  type="button"
                  className={ui.btnQuiet}
                  disabled={busy}
                  onClick={() => setConfirm(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className={ui.btnOutline}
                  disabled={busy}
                  onClick={() => void act(confirm)}
                >
                  {confirm === 'remove' ? 'Remove post' : 'Block collector'}
                </button>
              </div>
            </div>
          )}
        </article>
        <LoungeThread
          postId={post.id}
          removed={post.removed}
          onCountChange={(delta) =>
            setPost((current) => {
              if (!current) return current;
              const replyCount = Math.max(0, current.reply_count + delta);
              patchPost(postId, { reply_count: replyCount });
              return { ...current, reply_count: replyCount };
            })
          }
        />
      </div>
      {report && (
        <ReportDialog
          target={{ lounge_post_id: post.id }}
          subject="post"
          onClose={() => setReport(false)}
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
    </>
  );
}

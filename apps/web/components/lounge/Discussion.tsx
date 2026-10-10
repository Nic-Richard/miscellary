'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import type { LoungeCard, LoungePost, LoungeTopic, UserSummary } from '@miscellary/shared';
import { BLOCK_COPY, LOUNGE_TOPICS, loungeTopicLabel } from '@miscellary/shared';
import CardInspector from '@/components/CardInspector';
import LoungeShowcase from '@/components/LoungeShowcase';
import MoreMenu from '@/components/MoreMenu';
import ReportDialog from '@/components/ReportDialog';
import ShareButton from '@/components/ShareButton';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { editPost, userSummary, votePost } from '@/lib/lounge';
import { setBlocked, setFollow } from '@/lib/social';
import { timeAgo } from '@/lib/time';
import ui from '@/components/ui.module.css';
import AuthorName from './AuthorName';
import { useLounge } from './LoungeShell';
import LoungeThread from './LoungeThread';
import RichText from './RichText';
import SaveButton from './SaveButton';
import VoteControl from './VoteControl';
import styles from './Lounge.module.css';

const REMOVED: Partial<LoungePost> = {
  removed: true,
  title: 'Removed post',
  body: '',
  author: null,
  author_badge: null,
  cards: [],
};

export default function Discussion({ postId }: { postId: string }) {
  const { user } = useAuth();
  const { subscriber, patchPost, hideAuthor, reload } = useLounge();
  const [post, setPost] = useState<LoungePost | null>(null);
  const [author, setAuthor] = useState<UserSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<'block' | 'remove' | null>(null);
  const [editing, setEditing] = useState(false);
  const [report, setReport] = useState(false);
  const [inspect, setInspect] = useState<LoungeCard | null>(null);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    setPost(null);
    setAuthor(null);
    setError(null);
    setConfirm(null);
    setEditing(false);
    scroller.current?.scrollTo({ top: 0 });
    void apiFetch<LoungePost>(`/api/v1/lounge/posts/${postId}/`, { signal: controller.signal })
      .then((data) => {
        if (controller.signal.aborted) return;
        setPost(data);
        // Opening it marks new replies as read in the list.
        if (data.unread) patchPost(postId, { unread: false });
        if (data.author && !data.author.deleted && user)
          void userSummary(data.author.username)
            .then((summary) => {
              if (!controller.signal.aborted) setAuthor(summary);
            })
            .catch(() => undefined);
      })
      .catch((err: unknown) => {
        if (!controller.signal.aborted)
          setError(err instanceof Error ? err.message : 'Could not load this discussion.');
      });
    return () => controller.abort();
  }, [postId, version, user, patchPost]);

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
        await setBlocked(post.author.username, true);
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

  async function publish() {
    if (!post || busy) return;
    setBusy(true);
    try {
      setPost(await editPost(post.id, { publish: true }));
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not publish this draft.');
    } finally {
      setBusy(false);
    }
  }

  async function follow() {
    if (!author) return;
    const result = await setFollow(author.username, !author.is_following);
    setAuthor({ ...author, is_following: result.following, follower_count: result.follower_count });
    void userSummary(author.username, true);
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
        <article className={styles.post}>
          {!post.draft && !post.removed && (
            <VoteControl
              score={post.score}
              vote={post.my_vote}
              label={post.title}
              onVote={async (value) => {
                const result = await votePost(post.id, value);
                update({ score: result.score, my_vote: result.my_vote });
                return result;
              }}
            />
          )}
          <div className={styles.postMain}>
            {back}
            {post.draft && (
              <div className={styles.draftNote}>
                <p>Draft. Only you can see it until you publish.</p>
                <button
                  type="button"
                  className={`${ui.btnPrimary} ${ui.btnSmall}`}
                  disabled={busy}
                  onClick={() => void publish()}
                >
                  Publish
                </button>
              </div>
            )}
            <div className={styles.postMeta}>
              <AuthorName person={post.author} badge={post.author_badge} />
              {author && !author.is_me && !author.is_following && !author.is_blocked && (
                <button type="button" className={styles.followLink} onClick={() => void follow()}>
                  Follow
                </button>
              )}
              <time dateTime={post.created_at} title={new Date(post.created_at).toLocaleString()}>
                {timeAgo(post.created_at)}
              </time>
              {post.edited && <span className={styles.edited}>edited</span>}
              <span className={styles.chip}>{loungeTopicLabel(post.topic)}</span>
            </div>
            {editing ? (
              <PostEditor
                post={post}
                onCancel={() => setEditing(false)}
                onSaved={(saved) => {
                  update(saved);
                  setEditing(false);
                }}
              />
            ) : (
              <>
                <h1 className={styles.title}>{post.title}</h1>
                {post.removed ? (
                  <p className={ui.muted}>This post was removed. Replies keep their place.</p>
                ) : (
                  <RichText text={post.body} className={styles.body} />
                )}
              </>
            )}
            {post.cards.length > 0 && (
              <LoungeShowcase
                cards={post.cards}
                style={post.style}
                onInspect={setInspect}
                compact
              />
            )}
            <div className={styles.actions}>
              <span className={styles.act} aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <path d="M4 5h16v11H9l-5 4Z" />
                </svg>
                {post.reply_count} {post.reply_count === 1 ? 'reply' : 'replies'}
              </span>
              {user && !post.removed && !post.draft && (
                <SaveButton
                  postId={post.id}
                  saved={post.saved}
                  folderId={post.saved_folder}
                  supporter={subscriber}
                  onChange={(saved, folderId) => update({ saved, saved_folder: folderId })}
                />
              )}
              {!post.draft && <ShareButton path={`/lounge/${post.id}`} title={post.title} />}
              {user && !post.removed && (
                <MoreMenu
                  label={`More options for ${post.title}`}
                  items={[
                    ...(post.can_edit
                      ? [{ label: 'Edit post', onSelect: () => setEditing(true) }]
                      : []),
                    ...(!own ? [{ label: 'Report post', onSelect: () => setReport(true) }] : []),
                    ...(post.author && !post.author.deleted && !own
                      ? [
                          {
                            label: `Block @${post.author.username}`,
                            onSelect: () => setConfirm('block'),
                            danger: true,
                          },
                        ]
                      : []),
                    ...(post.can_delete
                      ? [
                          {
                            label: post.draft ? 'Delete draft' : 'Remove post',
                            onSelect: () => setConfirm('remove'),
                            danger: true,
                          },
                        ]
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
                    ? post.draft
                      ? 'Delete this draft?'
                      : 'Remove this post? Replies keep their place.'
                    : BLOCK_COPY.confirm(post.author?.username ?? '')}
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
                    {confirm === 'remove' ? (post.draft ? 'Delete' : 'Remove post') : 'Block'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </article>
        {!post.draft && (
          <LoungeThread
            postId={post.id}
            removed={post.removed}
            supporter={subscriber}
            onCountChange={(delta) =>
              setPost((current) => {
                if (!current) return current;
                const replyCount = Math.max(0, current.reply_count + delta);
                patchPost(postId, { reply_count: replyCount });
                return { ...current, reply_count: replyCount };
              })
            }
          />
        )}
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

function PostEditor({
  post,
  onCancel,
  onSaved,
}: {
  post: LoungePost;
  onCancel: () => void;
  onSaved: (post: LoungePost) => void;
}) {
  const [title, setTitle] = useState(post.title);
  const [body, setBody] = useState(post.body);
  const [topic, setTopic] = useState<LoungeTopic>(post.topic);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      onSaved(await editPost(post.id, { title, body, topic }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your changes.');
      setBusy(false);
    }
  }

  return (
    <form
      className={styles.editor}
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <input
        className={ui.input}
        aria-label="Title"
        maxLength={120}
        required
        value={title}
        onChange={(event) => setTitle(event.target.value)}
      />
      <textarea
        className={ui.input}
        aria-label="Post"
        rows={5}
        maxLength={3000}
        required
        value={body}
        onChange={(event) => setBody(event.target.value)}
      />
      <div className={styles.topics} role="radiogroup" aria-label="Topic">
        {LOUNGE_TOPICS.map((item) => (
          <label key={item.id}>
            <input
              type="radio"
              name="edit-topic"
              checked={topic === item.id}
              onChange={() => setTopic(item.id)}
            />
            <span>{item.label}</span>
          </label>
        ))}
      </div>
      {error && (
        <p role="alert" className={ui.error}>
          {error}
        </p>
      )}
      <div className={styles.formActions}>
        <button className={ui.btnPrimary} disabled={busy || !title.trim() || !body.trim()}>
          Save changes
        </button>
        <button type="button" className={ui.btnQuiet} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

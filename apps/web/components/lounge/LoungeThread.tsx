'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import type { LoungeReply, Paginated } from '@miscellary/shared';
import Avatar from '@/components/Avatar';
import { Composer } from '@/components/Comments';
import commentStyles from '@/components/Comments.module.css';
import LikeButton from '@/components/LikeButton';
import PersonLink from '@/components/PersonLink';
import ReportDialog from '@/components/ReportDialog';
import type { ReportTarget } from '@/components/ReportDialog';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { timeAgo } from '@/lib/time';
import ui from '@/components/ui.module.css';
import styles from './Lounge.module.css';

export default function LoungeThread({
  postId,
  parentId,
  removed = false,
  onCountChange,
  autoFocus = false,
}: {
  postId: string;
  parentId?: string;
  removed?: boolean;
  onCountChange?: (delta: number) => void;
  autoFocus?: boolean;
}) {
  const { user } = useAuth();
  const [rows, setRows] = useState<LoungeReply[]>([]);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0);
  const [open, setOpen] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<ReportTarget | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const mutation = useRef<AbortController | null>(null);

  useEffect(() => {
    setRows([]);
    setPage(1);
    setOpen(null);
    setReport(null);
    setConfirm(null);
    setBusy(false);
    return () => {
      mutation.current?.abort();
      mutation.current = null;
    };
  }, [user?.id, postId]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    void apiFetch<Paginated<LoungeReply>>(
      `/api/v1/lounge/posts/${postId}/replies/?page=${page}${parentId ? `&parent_id=${parentId}` : ''}`,
      { signal: controller.signal },
    )
      .then((data) => {
        if (controller.signal.aborted) return;
        setRows((current) => {
          if (page === 1) return data.results;
          const seen = new Set(current.map((row) => row.id));
          return [...current, ...data.results.filter((row) => !seen.has(row.id))];
        });
        setHasNext(Boolean(data.next));
        setError(null);
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

  async function mutate(path: string, method: string, data?: unknown) {
    if (mutation.current) {
      if (data) throw new Error('Please wait a moment and try again.');
      return;
    }
    const controller = new AbortController();
    mutation.current = controller;
    setBusy(true);
    setError(null);
    try {
      const result = await apiFetch<LoungeReply>(path, {
        method,
        signal: controller.signal,
        ...(data ? { body: data } : {}),
      });
      if (controller.signal.aborted) return;
      setConfirm(null);
      if (data) {
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
    } catch (err: unknown) {
      if (!controller.signal.aborted)
        setError(err instanceof Error ? err.message : 'Could not update replies.');
      if (data) throw err;
    } finally {
      if (mutation.current === controller) {
        mutation.current = null;
        setBusy(false);
      }
    }
  }

  const composer =
    user && !removed ? (
      <Composer
        placeholder={parentId ? 'Reply to this thread…' : 'Join the discussion…'}
        submitLabel="Reply"
        rows={parentId ? 2 : 1}
        disabled={loading && !rows.length}
        autoFocus={autoFocus}
        onSubmit={(body) =>
          mutate(`/api/v1/lounge/posts/${postId}/replies/`, 'POST', {
            body,
            parent_id: parentId ?? null,
          })
        }
      />
    ) : !user && !parentId && !removed ? (
      <p className={styles.signedOut}>
        <Link
          href={`/login?next=${encodeURIComponent(`/lounge/${postId}`)}`}
          className={commentStyles.link}
        >
          Log in
        </Link>{' '}
        to join the discussion.
      </p>
    ) : null;

  const list = (
    <div className={styles.thread}>
      {!parentId && <h2 className={styles.repliesHead}>Replies</h2>}
      {loading && !rows.length && (
        <p role="status" className={ui.muted}>
          Loading replies…
        </p>
      )}
      {!loading && !error && !rows.length && !parentId && (
        <p className={ui.muted}>No replies yet. Start the conversation.</p>
      )}
      {rows.map((reply) => (
        <div key={reply.id} className={styles.reply}>
          <Avatar person={reply.author} supporter={reply.author_badge} size={32} />
          <div className={styles.replyMain}>
            <div className={styles.replyBy}>
              {reply.author ? (
                <PersonLink person={reply.author} className={commentStyles.name}>
                  {reply.author.display_name || reply.author.username}
                </PersonLink>
              ) : (
                <b className={ui.muted}>Removed</b>
              )}
              <time dateTime={reply.created_at} className={styles.when}>
                {timeAgo(reply.created_at)}
              </time>
            </div>
            <p className={styles.body}>{reply.removed ? 'This reply was removed.' : reply.body}</p>
            {!reply.removed && user && (
              <div className={styles.replyTools}>
                <LikeButton
                  chip
                  liked={reply.liked}
                  count={reply.likes}
                  label="reply"
                  onToggle={async (liked) => {
                    const result = await apiFetch<{ liked: boolean; likes: number }>(
                      `/api/v1/lounge/replies/${reply.id}/vote/`,
                      { method: liked ? 'POST' : 'DELETE' },
                    );
                    setRows((current) =>
                      current.map((row) =>
                        row.id === reply.id
                          ? { ...row, liked: result.liked, likes: result.likes }
                          : row,
                      ),
                    );
                    return { liked: result.liked, like_count: result.likes };
                  }}
                />
                {!parentId && (
                  <button
                    type="button"
                    className={commentStyles.tool}
                    onClick={() => setOpen(reply.id)}
                  >
                    Reply
                  </button>
                )}
                <button
                  type="button"
                  className={commentStyles.tool}
                  onClick={() => setReport({ lounge_reply_id: reply.id })}
                >
                  Report
                </button>
                {reply.can_delete && (
                  <button
                    type="button"
                    className={commentStyles.tool}
                    disabled={busy}
                    onClick={() => setConfirm(reply.id)}
                  >
                    Remove
                  </button>
                )}
              </div>
            )}
            {confirm === reply.id && (
              <div className={styles.replyTools}>
                <span className={ui.muted}>Remove this reply?</span>
                <button
                  type="button"
                  className={`${commentStyles.tool} ${commentStyles.danger}`}
                  disabled={busy}
                  onClick={() => void mutate(`/api/v1/lounge/replies/${reply.id}/`, 'DELETE')}
                >
                  Remove
                </button>
                <button
                  type="button"
                  className={commentStyles.tool}
                  disabled={busy}
                  onClick={() => setConfirm(null)}
                >
                  Keep
                </button>
              </div>
            )}
            {!parentId && reply.child_count > 0 && open !== reply.id && (
              <button type="button" className={ui.link} onClick={() => setOpen(reply.id)}>
                Show {reply.child_count} {reply.child_count === 1 ? 'reply' : 'replies'}
              </button>
            )}
          </div>
          {open === reply.id && (
            <div className={styles.children}>
              <LoungeThread
                key={reply.id}
                postId={postId}
                parentId={reply.id}
                removed={removed || reply.removed}
                autoFocus
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
              <button type="button" className={ui.link} onClick={() => setOpen(null)}>
                Hide replies
              </button>
            </div>
          )}
        </div>
      ))}
      {hasNext && (
        <button
          type="button"
          className={ui.btnQuiet}
          disabled={loading}
          onClick={() => setPage((value) => value + 1)}
        >
          More replies
        </button>
      )}
      {error && (
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
      )}
      {report && <ReportDialog target={report} subject="reply" onClose={() => setReport(null)} />}
    </div>
  );

  if (parentId)
    return (
      <>
        {list}
        {composer}
      </>
    );
  return (
    <>
      <section className={styles.replies} aria-label="Replies">
        {list}
      </section>
      {composer && <div className={styles.replyBox}>{composer}</div>}
    </>
  );
}

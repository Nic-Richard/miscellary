'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import type { LoungeReply, Paginated } from '@miscellary/shared';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import LikeButton from './LikeButton';
import PersonLink from './PersonLink';
import SupporterBadge from './SupporterBadge';
import { Composer, Monogram } from './Comments';
import commentStyles from './Comments.module.css';
import { timeAgo } from '@/lib/time';
import ReportDialog from './ReportDialog';
import type { ReportTarget } from './ReportDialog';
import ui from './ui.module.css';
import styles from '@/app/lounge/page.module.css';

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
        if (!controller.signal.aborted) {
          setRows(data.results);
          setHasNext(Boolean(data.next));
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
  async function mutate(path: string, method: string, data?: unknown) {
    if (mutation.current || loading) {
      if (data) throw new Error('Please wait for the replies to finish loading.');
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
  return (
    <div className={styles.thread}>
      {user && !removed && (
        <Composer
          placeholder={parentId ? 'Reply to this thread…' : 'Join the discussion…'}
          submitLabel="Post reply"
          disabled={loading}
          autoFocus={autoFocus}
          onSubmit={(body) =>
            mutate(`/api/v1/lounge/posts/${postId}/replies/`, 'POST', {
              body,
              parent_id: parentId ?? null,
            })
          }
        />
      )}
      {!user && !parentId && !removed && (
        <p className={commentStyles.signedOut}>
          <Link
            href={`/login?next=${encodeURIComponent(`/lounge/${postId}`)}`}
            className={commentStyles.link}
          >
            Sign in
          </Link>{' '}
          to join the discussion.
        </p>
      )}
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
          <div className={styles.byline}>
            <Monogram name={reply.author?.display_name || reply.author?.username || '?'} />
            {reply.author ? (
              <PersonLink person={reply.author} className={commentStyles.name}>
                {reply.author.display_name || reply.author.username}
              </PersonLink>
            ) : (
              <span className={ui.muted}>Removed reply</span>
            )}
            {reply.author_badge && <SupporterBadge />}
            <time dateTime={reply.created_at} className={styles.when}>
              {timeAgo(reply.created_at)}
            </time>
          </div>
          <p className={styles.body}>{reply.removed ? 'This reply was removed.' : reply.body}</p>
          {!reply.removed && user && (
            <div className={styles.tools}>
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
                  onClick={() => {
                    setOpen(reply.id);
                  }}
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
                  disabled={busy || loading}
                  onClick={() => setConfirm(reply.id)}
                >
                  Remove
                </button>
              )}
            </div>
          )}
          {confirm === reply.id && (
            <div className={styles.tools}>
              <span className={ui.muted}>Remove this reply?</span>
              <button
                type="button"
                className={`${commentStyles.tool} ${commentStyles.danger}`}
                disabled={busy || loading}
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
          {!parentId && reply.child_count > 0 && (
            <button
              type="button"
              className={ui.link}
              onClick={() => setOpen(open === reply.id ? null : reply.id)}
            >
              {open === reply.id ? 'Hide' : 'Show'} replies ({reply.child_count})
            </button>
          )}
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
            </div>
          )}
        </div>
      ))}
      {(page > 1 || hasNext) && (
        <div className={styles.tools}>
          {page > 1 && (
            <button
              type="button"
              className={ui.btnQuiet}
              disabled={busy || loading}
              onClick={() => {
                setRows([]);
                setPage((value) => value - 1);
              }}
            >
              Previous replies
            </button>
          )}
          {hasNext && (
            <button
              type="button"
              className={ui.btnQuiet}
              disabled={busy || loading}
              onClick={() => {
                setRows([]);
                setPage((value) => value + 1);
              }}
            >
              More replies
            </button>
          )}
        </div>
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
            Retry replies
          </button>
        </>
      )}
      {report && <ReportDialog target={report} subject="reply" onClose={() => setReport(null)} />}
    </div>
  );
}

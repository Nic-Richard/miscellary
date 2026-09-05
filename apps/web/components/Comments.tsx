'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Comment } from '@miscellary/shared';
import { deleteComment, getComments, postComment } from '@/lib/social';
import { useAuth } from '@/lib/auth';
import ReportButton from './ReportButton';
import ui from './ui.module.css';
import styles from './Comments.module.css';

const MAX = 1000;

function when(iso: string): string {
  const secs = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60) return 'just now';
  const mins = secs / 60;
  if (mins < 60) return `${Math.floor(mins)}m ago`;
  const hours = mins / 60;
  if (hours < 24) return `${Math.floor(hours)}h ago`;
  const days = hours / 24;
  if (days < 7) return `${Math.floor(days)}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function Monogram({ name }: { name: string }) {
  return <span className={styles.monogram}>{name.charAt(0).toUpperCase() || '?'}</span>;
}

function Composer({
  placeholder,
  submitLabel,
  autoFocus,
  onSubmit,
  onCancel,
}: {
  placeholder: string;
  submitLabel: string;
  autoFocus?: boolean;
  onSubmit: (body: string) => Promise<void>;
  onCancel?: () => void;
}) {
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const box = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (autoFocus) box.current?.focus();
  }, [autoFocus]);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(240, el.scrollHeight)}px`;
  }, [body]);

  async function send() {
    const text = body.trim();
    if (!text || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onSubmit(text);
      setBody('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not post that.');
    } finally {
      setBusy(false);
    }
  }

  const left = MAX - body.length;

  return (
    <div className={styles.composer}>
      <textarea
        ref={box}
        className={`${ui.input} ${styles.box}`}
        aria-label={submitLabel === 'Post' ? 'New comment' : placeholder}
        placeholder={placeholder}
        value={body}
        maxLength={MAX}
        rows={2}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            void send();
          }
          if (e.key === 'Escape' && onCancel) onCancel();
        }}
      />
      <div className={styles.composerFoot}>
        {error ? (
          <span className={styles.error}>{error}</span>
        ) : (
          <span className={styles.count}>{left < 100 ? `${left} left` : ''}</span>
        )}
        {onCancel ? (
          <button type="button" className={`${ui.btnQuiet} ${ui.btnSmall}`} onClick={onCancel}>
            Cancel
          </button>
        ) : null}
        <button
          type="button"
          className={`${ui.btnPrimary} ${ui.btnSmall}`}
          onClick={() => void send()}
          disabled={busy || body.trim().length === 0}
        >
          {busy ? 'Posting…' : submitLabel}
        </button>
      </div>
    </div>
  );
}

function Replies({
  replies,
  onReply,
  onDelete,
}: {
  replies: Comment[];
  onReply: (parentId: string, body: string) => Promise<void>;
  onDelete: (id: string) => void;
}) {
  if (replies.length === 0) return null;
  return (
    <ul className={styles.replies}>
      {replies.map((reply) => (
        <Note key={reply.id} comment={reply} depth={1} onReply={onReply} onDelete={onDelete} />
      ))}
    </ul>
  );
}

function Note({
  comment,
  depth,
  onReply,
  onDelete,
}: {
  comment: Comment;
  depth: 0 | 1;
  onReply: (parentId: string, body: string) => Promise<void>;
  onDelete: (id: string) => void;
}) {
  const { user } = useAuth();
  const [replying, setReplying] = useState(false);
  const [confirming, setConfirming] = useState(false);

  if (comment.removed) {
    return (
      <li className={styles.note} data-depth={depth}>
        <p className={styles.tomb}>Comment removed</p>
        <Replies replies={comment.replies} onReply={onReply} onDelete={onDelete} />
      </li>
    );
  }

  const name = comment.author?.display_name || comment.author?.username || 'Someone';

  return (
    <li className={styles.note} data-depth={depth}>
      <div className={styles.card}>
        <div className={styles.head}>
          <Monogram name={name} />
          {comment.author ? (
            <Link href={`/users/${comment.author.username}`} className={styles.name}>
              {name}
            </Link>
          ) : (
            <span className={styles.name}>{name}</span>
          )}
          {comment.is_creator ? <span className={styles.creatorTag}>Creator</span> : null}
          <time className={styles.when} dateTime={comment.created_at}>
            {when(comment.created_at)}
          </time>
        </div>

        <p className={styles.text}>{comment.body}</p>

        <div className={styles.tools}>
          {user && depth === 0 ? (
            <button
              type="button"
              className={styles.tool}
              onClick={() => setReplying((open) => !open)}
            >
              Reply
            </button>
          ) : null}
          {comment.can_delete ? (
            confirming ? (
              <>
                <button
                  type="button"
                  className={`${styles.tool} ${styles.danger}`}
                  onClick={() => onDelete(comment.id)}
                >
                  Really remove
                </button>
                <button type="button" className={styles.tool} onClick={() => setConfirming(false)}>
                  Keep
                </button>
              </>
            ) : (
              <button type="button" className={styles.tool} onClick={() => setConfirming(true)}>
                Remove
              </button>
            )
          ) : null}
          {user && comment.author && user.profile.username !== comment.author.username ? (
            <ReportButton target={{ comment_id: comment.id }} />
          ) : null}
        </div>

        {replying ? (
          <Composer
            autoFocus
            placeholder={`Reply to ${name}…`}
            submitLabel="Reply"
            onCancel={() => setReplying(false)}
            onSubmit={async (body) => {
              await onReply(comment.id, body);
              setReplying(false);
            }}
          />
        ) : null}
      </div>

      <Replies replies={comment.replies} onReply={onReply} onDelete={onDelete} />
    </li>
  );
}

export default function Comments({ slug }: { slug: string }) {
  const { user } = useAuth();
  const [thread, setThread] = useState<Comment[] | null>(null);
  const [count, setCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const page = await getComments(slug);
    setThread(page.results);
    setCount(page.count);
  }, [slug]);

  useEffect(() => {
    load().catch(() => setThread([]));
  }, [load]);

  async function post(body: string, parentId?: string) {
    await postComment(slug, body, parentId);
    await load();
  }

  async function remove(id: string) {
    try {
      await deleteComment(id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not remove that.');
    }
  }

  return (
    <section className={styles.section} id="comments">
      <div className={styles.column}>
        <header className={styles.sectionHead}>
          <h2 className={styles.title}>Comments</h2>
          <span className={styles.meta}>
            {count === 0 ? 'None yet' : `${count} ${count === 1 ? 'note' : 'notes'}`}
          </span>
        </header>

        {user ? (
          <Composer
            placeholder="Say something about this set…"
            submitLabel="Post"
            onSubmit={(body) => post(body)}
          />
        ) : (
          <p className={styles.signedOut}>
            <Link href="/login" className={styles.link}>
              Sign in
            </Link>{' '}
            to leave a note about this set.
          </p>
        )}

        {error ? <p className={ui.error}>{error}</p> : null}

        {thread === null ? (
          <p className={styles.empty}>Loading…</p>
        ) : thread.length === 0 ? (
          <p className={styles.empty}>
            Nothing here yet. Ask the collector about a card, or say which one you pulled.
          </p>
        ) : (
          <ul className={styles.thread}>
            {thread.map((comment) => (
              <Note
                key={comment.id}
                comment={comment}
                depth={0}
                onReply={(parentId, body) => post(body, parentId)}
                onDelete={(id) => void remove(id)}
              />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

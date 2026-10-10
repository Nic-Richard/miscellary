'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import type { LoungeCard, LoungeReply, OwnedCard, Paginated, ReplySort } from '@miscellary/shared';
import { LOUNGE_LIMITS } from '@miscellary/shared';
import CardInspector from '@/components/CardInspector';
import LoungeShowcase from '@/components/LoungeShowcase';
import ReportDialog from '@/components/ReportDialog';
import type { ReportTarget } from '@/components/ReportDialog';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { editReply, voteReply } from '@/lib/lounge';
import { timeAgo } from '@/lib/time';
import ui from '@/components/ui.module.css';
import AuthorName from './AuthorName';
import CardPicker from './CardPicker';
import RichText from './RichText';
import VoteControl from './VoteControl';
import styles from './Lounge.module.css';

const SORTS: { id: ReplySort; label: string }[] = [
  { id: 'top', label: 'Top' },
  { id: 'new', label: 'New' },
  { id: 'oldest', label: 'Oldest' },
];

const REMOVED: Partial<LoungeReply> = {
  removed: true,
  body: '',
  author: null,
  author_badge: null,
  score: 0,
  my_vote: 0,
  cards: [],
  can_edit: false,
};

export default function LoungeThread({
  postId,
  parentId,
  removed = false,
  supporter,
  onCountChange,
  autoFocus = false,
}: {
  postId: string;
  parentId?: string;
  removed?: boolean;
  supporter: boolean;
  onCountChange?: (delta: number) => void;
  autoFocus?: boolean;
}) {
  const { user } = useAuth();
  const [rows, setRows] = useState<LoungeReply[]>([]);
  const [sort, setSort] = useState<ReplySort>(parentId ? 'oldest' : 'top');
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0);
  const [open, setOpen] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<ReportTarget | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [inspect, setInspect] = useState<LoungeCard | null>(null);

  useEffect(() => {
    setRows([]);
    setPage(1);
    setOpen(null);
    setEditing(null);
    setReport(null);
    setConfirm(null);
  }, [user?.id, postId, sort]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), sort });
    if (parentId) params.set('parent_id', parentId);
    void apiFetch<Paginated<LoungeReply>>(
      `/api/v1/lounge/posts/${postId}/replies/?${params.toString()}`,
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
  }, [postId, parentId, page, sort, version, user?.id]);

  function patch(id: string, change: Partial<LoungeReply>) {
    setRows((current) => current.map((row) => (row.id === id ? { ...row, ...change } : row)));
  }

  async function remove(reply: LoungeReply) {
    try {
      await apiFetch(`/api/v1/lounge/replies/${reply.id}/`, { method: 'DELETE' });
      patch(reply.id, REMOVED);
      setConfirm(null);
      if (!reply.removed) onCountChange?.(-1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove that reply.');
    }
  }

  const composer =
    user && !removed ? (
      <ReplyComposer
        postId={postId}
        parentId={parentId}
        supporter={supporter}
        autoFocus={autoFocus}
        onPosted={(reply) => {
          setRows((current) => [...current, reply]);
          onCountChange?.(1);
        }}
      />
    ) : !user && !parentId && !removed ? (
      <p className={styles.signedOut}>
        <Link href={`/login?next=${encodeURIComponent(`/lounge/${postId}`)}`}>Log in</Link> to join
        the discussion.
      </p>
    ) : null;

  const list = (
    <div className={styles.thread}>
      {!parentId && (
        <div className={styles.repliesHead}>
          <h2>Replies</h2>
          <div className={ui.segments} role="group" aria-label="Sort replies">
            {SORTS.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`${ui.segment} ${sort === item.id ? ui.segmentOn : ''} ${styles.sort}`}
                aria-pressed={sort === item.id}
                onClick={() => setSort(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
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
          <div className={styles.replyMain}>
            <div className={styles.replyBy}>
              {reply.author ? (
                <AuthorName person={reply.author} badge={reply.author_badge} avatarSize={28} />
              ) : (
                <b className={ui.muted}>Removed</b>
              )}
              {reply.is_op && <span className={styles.op}>OP</span>}
              <time dateTime={reply.created_at} className={styles.when}>
                {timeAgo(reply.created_at)}
              </time>
              {reply.edited && <span className={styles.edited}>edited</span>}
            </div>
            {editing === reply.id ? (
              <ReplyEditor
                reply={reply}
                onCancel={() => setEditing(null)}
                onSaved={(saved) => {
                  patch(reply.id, saved);
                  setEditing(null);
                }}
              />
            ) : (
              <RichText
                text={reply.removed ? 'This reply was removed.' : reply.body}
                className={styles.body}
              />
            )}
            {reply.cards.length > 0 && (
              <LoungeShowcase cards={reply.cards} style="plain" onInspect={setInspect} compact />
            )}
            {!reply.removed && (
              <div className={styles.replyTools}>
                <VoteControl
                  compact
                  score={reply.score}
                  vote={reply.my_vote}
                  label="this reply"
                  onVote={async (value) => {
                    const result = await voteReply(reply.id, value);
                    patch(reply.id, { score: result.score, my_vote: result.my_vote });
                    return result;
                  }}
                />
                {user && !parentId && !removed && (
                  <button type="button" className={styles.tool} onClick={() => setOpen(reply.id)}>
                    Reply
                  </button>
                )}
                {reply.can_edit && (
                  <button
                    type="button"
                    className={styles.tool}
                    onClick={() => setEditing(reply.id)}
                  >
                    Edit
                  </button>
                )}
                {user && !reply.can_edit && (
                  <button
                    type="button"
                    className={styles.tool}
                    onClick={() => setReport({ lounge_reply_id: reply.id })}
                  >
                    Report
                  </button>
                )}
                {reply.can_delete && (
                  <button
                    type="button"
                    className={styles.tool}
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
                  className={`${styles.tool} ${styles.danger}`}
                  onClick={() => void remove(reply)}
                >
                  Remove
                </button>
                <button type="button" className={styles.tool} onClick={() => setConfirm(null)}>
                  Keep
                </button>
              </div>
            )}
            {!parentId && reply.child_count > 0 && open !== reply.id && (
              <button
                type="button"
                className={styles.showReplies}
                onClick={() => setOpen(reply.id)}
              >
                Show {reply.child_count} {reply.child_count === 1 ? 'reply' : 'replies'}
              </button>
            )}
            {open === reply.id && (
              <div className={styles.children}>
                <LoungeThread
                  key={reply.id}
                  postId={postId}
                  parentId={reply.id}
                  removed={removed || reply.removed}
                  supporter={supporter}
                  autoFocus
                  onCountChange={(delta) => {
                    if (delta > 0) patch(reply.id, { child_count: reply.child_count + delta });
                    onCountChange?.(delta);
                  }}
                />
                <button type="button" className={styles.showReplies} onClick={() => setOpen(null)}>
                  Hide replies
                </button>
              </div>
            )}
          </div>
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

function ReplyComposer({
  postId,
  parentId,
  supporter,
  autoFocus,
  onPosted,
}: {
  postId: string;
  parentId?: string | undefined;
  supporter: boolean;
  autoFocus: boolean;
  onPosted: (reply: LoungeReply) => void;
}) {
  const [body, setBody] = useState('');
  const [cards, setCards] = useState<OwnedCard[]>([]);
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  const max = supporter ? LOUNGE_LIMITS.supporterReplyCards : LOUNGE_LIMITS.replyCards;

  useEffect(() => {
    if (autoFocus) field.current?.focus();
  }, [autoFocus]);

  async function send() {
    const text = body.trim();
    if (!text || busy) return;
    setBusy(true);
    setError(null);
    try {
      const reply = await apiFetch<LoungeReply>(`/api/v1/lounge/posts/${postId}/replies/`, {
        method: 'POST',
        body: { body: text, parent_id: parentId ?? null, card_ids: cards.map((card) => card.id) },
      });
      onPosted(reply);
      setBody('');
      setCards([]);
      setPicking(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Your reply has not been posted.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      className={styles.composer}
      onSubmit={(event) => {
        event.preventDefault();
        void send();
      }}
    >
      {picking && <CardPicker max={max} selected={cards} onChange={setCards} />}
      <div className={styles.composerRow}>
        <textarea
          ref={field}
          className={ui.input}
          aria-label={parentId ? 'Reply to this thread' : 'Join the discussion'}
          placeholder={parentId ? 'Reply to this thread…' : 'Join the discussion…'}
          rows={parentId ? 2 : 1}
          maxLength={1000}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) void send();
          }}
        />
        <button
          type="button"
          className={`${styles.attach} ${picking || cards.length ? styles.attachOn : ''}`}
          aria-label={cards.length ? `${cards.length} cards attached` : 'Add cards'}
          aria-pressed={picking}
          onClick={() => setPicking((value) => !value)}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <rect x="5" y="3" width="11" height="16" rx="2" />
            <path d="M9 21h8a2 2 0 0 0 2-2V8" />
          </svg>
          {cards.length > 0 && <b>{cards.length}</b>}
        </button>
        <button className={`${ui.btnPrimary} ${ui.btnSmall}`} disabled={busy || !body.trim()}>
          Reply
        </button>
      </div>
      {error && (
        <p role="alert" className={ui.error}>
          {error}
        </p>
      )}
    </form>
  );
}

function ReplyEditor({
  reply,
  onCancel,
  onSaved,
}: {
  reply: LoungeReply;
  onCancel: () => void;
  onSaved: (reply: LoungeReply) => void;
}) {
  const [body, setBody] = useState(reply.body);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className={styles.editor}
      onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        setError(null);
        try {
          onSaved(await editReply(reply.id, body));
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Could not save your changes.');
          setBusy(false);
        }
      }}
    >
      <textarea
        className={ui.input}
        aria-label="Edit reply"
        rows={3}
        maxLength={1000}
        value={body}
        onChange={(event) => setBody(event.target.value)}
      />
      {error && (
        <p role="alert" className={ui.error}>
          {error}
        </p>
      )}
      <div className={styles.formActions}>
        <button className={`${ui.btnPrimary} ${ui.btnSmall}`} disabled={busy || !body.trim()}>
          Save
        </button>
        <button type="button" className={`${ui.btnQuiet} ${ui.btnSmall}`} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

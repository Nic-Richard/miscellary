'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Notification, NotificationKind } from '@miscellary/shared';
import PageHeader from '@/components/PageHeader';
import DemoBadge from '@/components/DemoBadge';
import { NOTICE_EVENT } from '@/components/Nav';
import Sheet, { Empty } from '@/components/Sheet';
import { useAuth } from '@/lib/auth';
import { useRequireAccount } from '@/lib/requireAccount';
import { getNotifications, markNotificationsRead } from '@/lib/social';
import { timeAgo } from '@/lib/time';
import ui from '@/components/ui.module.css';
import styles from './page.module.css';

const HEART =
  'M12 20.4 4.2 12.8a4.6 4.6 0 0 1 0-6.6 4.6 4.6 0 0 1 6.5 0l1.3 1.3 1.3-1.3a4.6 4.6 0 0 1 6.5 0 4.6 4.6 0 0 1 0 6.6Z';

const MARKS: Record<NotificationKind, string> = {
  set_like: HEART,
  card_like: HEART,
  set_comment: 'M4 5h16v11H9l-5 4Z',
  comment_reply: 'M9 8 4 12l5 4M4 12h9a6 6 0 0 1 6 6',
  follow:
    'M12 11a3.4 3.4 0 1 0 0-7 3.4 3.4 0 0 0 0 7Zm-6 9c0-3.6 2.7-5.6 6-5.6s6 2 6 5.6M18 4v5m2.5-2.5h-5',
};

const FILLED: NotificationKind[] = ['set_like', 'card_like'];

const FILTERS: { value: 'all' | NotificationKind; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'set_like', label: 'Set likes' },
  { value: 'card_like', label: 'Card likes' },
  { value: 'set_comment', label: 'Comments' },
  { value: 'comment_reply', label: 'Replies' },
  { value: 'follow', label: 'Followers' },
];

function describe(n: Notification): { text: string; href: string | null } {
  const set = n.set_title ?? 'a set';
  const setHref = n.set_slug ? `/sets/${n.set_slug}` : null;
  switch (n.kind) {
    case 'set_like':
      return { text: `liked ${set}`, href: setHref };
    case 'card_like':
      return { text: `liked ${n.card_title ?? 'a card'} in ${set}`, href: setHref };
    case 'set_comment':
      return { text: `commented on ${set}`, href: setHref };
    case 'comment_reply':
      return { text: `replied to you on ${set}`, href: setHref };
    case 'follow':
      return { text: 'started following you', href: `/users/${n.actor.username}` };
  }
}

function Row({ notification }: { notification: Notification }) {
  const { text, href } = describe(notification);
  const actor = notification.actor;
  const kind = notification.kind;
  const object = notification.card_image ?? notification.set_pack_image;

  const body = (
    <>
      <span className={styles.who} aria-hidden="true">
        <span className={styles.monogram}>
          {(actor.display_name || actor.username)[0]?.toUpperCase()}
        </span>
        <span className={`${styles.mark} ${FILLED.includes(kind) ? styles.markLike : ''}`}>
          <svg viewBox="0 0 24 24">
            <path d={MARKS[kind]} />
          </svg>
        </span>
      </span>

      <span className={styles.line}>
        <span className={styles.said}>
          <strong>{actor.display_name || `@${actor.username}`}</strong>
          {actor.is_demo ? <DemoBadge compact /> : null} {text}
        </span>
        {notification.comment_body ? (
          <q className={styles.quote}>{notification.comment_body}</q>
        ) : null}
        <time className={styles.when} dateTime={notification.created_at}>
          {timeAgo(notification.created_at)}
        </time>
      </span>

      {object ? (
        <span
          className={`${styles.object} ${notification.card_image ? styles.objectCard : styles.objectPack}`}
          aria-hidden="true"
        >
          <img src={object} alt="" loading="lazy" draggable={false} />
        </span>
      ) : (
        <span className={styles.object} />
      )}
    </>
  );

  return (
    <li className={`${styles.row} ${notification.read ? '' : styles.unread}`}>
      {href ? (
        <Link href={href} className={styles.link}>
          {body}
        </Link>
      ) : (
        <span className={styles.link}>{body}</span>
      )}
    </li>
  );
}

export default function NotificationsPage() {
  const { user, loading } = useAuth();
  useRequireAccount();
  const [rows, setRows] = useState<Notification[] | null>(null);
  const [unread, setUnread] = useState(0);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<'all' | NotificationKind>('all');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    getNotifications()
      .then((result) => {
        setRows(result.results);
        setUnread(result.unread);
        setTotal(result.count);
        setMore(result.next !== null);
        setPage(1);
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  function loadMore() {
    const next = page + 1;
    setBusy(true);
    getNotifications(next)
      .then((result) => {
        setRows((current) => [...(current ?? []), ...result.results]);
        setMore(result.next !== null);
        setPage(next);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setBusy(false));
  }

  useEffect(() => {
    if (!user) return;
    load();
  }, [user, load]);

  const counts = useMemo(() => {
    const tally = { all: rows?.length ?? 0 } as Record<'all' | NotificationKind, number>;
    for (const f of FILTERS) if (f.value !== 'all') tally[f.value] = 0;
    for (const row of rows ?? []) tally[row.kind] += 1;
    return tally;
  }, [rows]);

  const shown = useMemo(
    () => (filter === 'all' ? (rows ?? []) : (rows ?? []).filter((r) => r.kind === filter)),
    [rows, filter],
  );

  async function markAll() {
    setRows((current) => current?.map((r) => ({ ...r, read: true })) ?? null);
    setUnread(0);
    try {
      await markNotificationsRead();
      window.dispatchEvent(new Event(NOTICE_EVENT));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not mark those as read.');
      load();
    }
  }

  if (loading || !user) return <p className={ui.muted}>Loading…</p>;

  return (
    <div className={styles.page}>
      <PageHeader
        title="Notifications"
        description={unread > 0 ? `${unread} unread` : 'All caught up'}
        actions={
          unread > 0 ? (
            <button type="button" className={ui.btnQuiet} onClick={() => void markAll()}>
              Mark all read
            </button>
          ) : null
        }
      />
      {error ? <p className={ui.error}>{error}</p> : null}

      <div className={styles.column}>
        {FILTERS.some((f) => f.value !== 'all' && counts[f.value] > 0) ? (
          <div className={`${ui.segments} ${styles.filters}`} role="tablist" aria-label="Show">
            {FILTERS.filter((f) => f.value === 'all' || counts[f.value] > 0).map((f) => (
              <button
                key={f.value}
                type="button"
                role="tab"
                aria-selected={filter === f.value}
                className={`${ui.segment} ${filter === f.value ? ui.segmentOn : ''}`}
                onClick={() => setFilter(f.value)}
              >
                {f.label}
              </button>
            ))}
          </div>
        ) : null}
        <Sheet>
          {rows === null ? (
            <Empty icon="cards">Loading…</Empty>
          ) : (
            <>
              {shown.length === 0 ? (
                <Empty
                  icon="cards"
                  action={
                    filter === 'all' ? (
                      <Link className={ui.btnOutline} href="/sets">
                        Browse sets
                      </Link>
                    ) : (
                      <button type="button" className={ui.action} onClick={() => setFilter('all')}>
                        Show everything
                      </button>
                    )
                  }
                >
                  {filter === 'all'
                    ? 'Nothing yet. You will hear when someone likes or comments on a set of yours, replies to you, or follows you — and nothing else.'
                    : 'Nothing of that kind yet.'}
                </Empty>
              ) : (
                <ul className={styles.rows}>
                  {shown.map((n) => (
                    <Row key={n.id} notification={n} />
                  ))}
                </ul>
              )}
              {more ? (
                <button type="button" className={styles.more} disabled={busy} onClick={loadMore}>
                  {busy ? 'Loading…' : `Show older (${total - (rows?.length ?? 0)} further back)`}
                </button>
              ) : null}
            </>
          )}
        </Sheet>
      </div>
    </div>
  );
}

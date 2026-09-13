'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { Creator } from '@miscellary/shared';
import { listFollows } from '@/lib/social';
import DemoBadge from './DemoBadge';
import Sheet, { Empty } from './Sheet';
import styles from './PeopleList.module.css';

export default function PeopleList({
  username,
  direction,
  onClose,
}: {
  username: string;
  direction: 'followers' | 'following';
  onClose: () => void;
}) {
  const [people, setPeople] = useState<Creator[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPeople(null);
    setPage(1);
    listFollows(username, direction)
      .then((result) => {
        setPeople(result.results);
        setTotal(result.count);
        setMore(result.next !== null);
      })
      .catch((e: Error) => setError(e.message));
  }, [username, direction]);

  function loadMore() {
    const next = page + 1;
    setBusy(true);
    listFollows(username, direction, next)
      .then((result) => {
        setPeople((current) => [...(current ?? []), ...result.results]);
        setMore(result.next !== null);
        setPage(next);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setBusy(false));
  }

  const title = direction === 'followers' ? 'Followers' : 'Following';

  return (
    <Sheet
      title={title}
      meta={people ? `${total}` : undefined}
      actions={
        <button type="button" className={styles.close} onClick={onClose}>
          Close
        </button>
      }
    >
      {error ? (
        <Empty icon="cards">{error}</Empty>
      ) : people === null ? (
        <Empty icon="cards">Loading…</Empty>
      ) : people.length === 0 ? (
        <Empty icon="cards">
          {direction === 'followers'
            ? `Nobody follows @${username} yet.`
            : `@${username} is not following anyone yet.`}
        </Empty>
      ) : (
        <ul className={styles.list}>
          {people.map((p) => (
            <li key={p.username}>
              <Link href={`/users/${p.username}`} className={styles.person}>
                <span className={styles.monogram} aria-hidden="true">
                  {(p.display_name || p.username)[0]?.toUpperCase()}
                </span>
                <span className={styles.names}>
                  <strong>{p.display_name || p.username}</strong>
                  <small>@{p.username}</small>
                </span>
                {p.is_demo ? <DemoBadge compact /> : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
      {more ? (
        <button type="button" className={styles.more} disabled={busy} onClick={loadMore}>
          {busy ? 'Loading…' : `Show more (${total - (people?.length ?? 0)} to go)`}
        </button>
      ) : null}
    </Sheet>
  );
}

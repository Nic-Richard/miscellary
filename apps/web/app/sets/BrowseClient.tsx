'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { CardSetSummary, Paginated } from '@miscellary/shared';
import PageHeader from '@/components/PageHeader';
import SearchField from '@/components/SearchField';
import SetTile from '@/components/SetTile';
import Sheet, { Empty } from '@/components/Sheet';
import tileStyles from '@/components/SetTile.module.css';
import ui from '@/components/ui.module.css';
import wide from '@/components/pageWide.module.css';
import { apiFetch } from '@/lib/api';
import styles from './page.module.css';

type Sort = 'top' | 'new' | 'hot' | 'recent';
const SORTS: { id: Sort; label: string }[] = [
  { id: 'top', label: 'Top' },
  { id: 'new', label: 'New' },
  { id: 'hot', label: 'Hot' },
  { id: 'recent', label: 'Most recent' },
];

export default function BrowseClient({
  newest,
  popular,
}: {
  newest: CardSetSummary[];
  popular: CardSetSummary[];
}) {
  const router = useRouter();
  const [sort, setSort] = useState<Sort>('new');
  const [q, setQ] = useState('');
  const [fetched, setFetched] = useState<CardSetSummary[] | null>(null);
  const preloaded = sort === 'new' ? newest : sort === 'top' ? popular : null;

  useEffect(() => {
    if (preloaded) return;
    const controller = new AbortController();
    setFetched(null);
    void apiFetch<Paginated<CardSetSummary>>(`/api/v1/sets/?sort=${sort}`, {
      signal: controller.signal,
      auth: false,
    })
      .then((page) => {
        if (!controller.signal.aborted) setFetched(page.results);
      })
      .catch(() => {
        if (!controller.signal.aborted) setFetched([]);
      });
    return () => controller.abort();
  }, [sort, preloaded]);

  const sets = preloaded ?? fetched ?? [];
  const loading = !preloaded && fetched === null;

  if (!newest.length)
    return (
      <section className={wide.page}>
        <PageHeader title="Sets" description="Every published set" />
        <Sheet className={styles.sheet}>
          <Empty
            icon="binder"
            action={
              <Link className={ui.btnPrimary} href="/studio">
                Start a set
              </Link>
            }
          >
            Nothing published yet. Anything you collect can be a set, so the catalogue is waiting on
            its first one.
          </Empty>
        </Sheet>
      </section>
    );

  return (
    <section className={wide.page}>
      <PageHeader title="Sets" description="Every published set" />
      <div className={styles.board}>
        <nav className={ui.binderTabs} aria-label="Sort sets">
          {SORTS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={ui.binderTab}
              aria-pressed={sort === item.id}
              onClick={() => setSort(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <div className={`${ui.board} ${styles.shelf}`}>
          <div className={`${ui.boardInner} ${styles.shelfInner}`}>
            <div className={styles.tools}>
              <SearchField
                className={styles.search}
                value={q}
                onChange={setQ}
                onSubmit={(term) => router.push(`/search?q=${encodeURIComponent(term)}`)}
                placeholder="Find a set, card or subject"
                label="Search sets, cards, subjects and users"
              />
              <span className={styles.count}>
                {loading ? 'Loading…' : `${sets.length} ${sets.length === 1 ? 'set' : 'sets'}`}
              </span>
            </div>
            {!loading && !sets.length ? (
              <p className={ui.muted}>Nothing here yet.</p>
            ) : (
              <ul className={tileStyles.grid}>
                {sets.map((s) => (
                  <li key={s.id}>
                    <SetTile set={s} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

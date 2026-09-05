'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { CardSetSummary } from '@miscellary/shared';
import BinderCover from '@/components/BinderCover';
import Sheet, { Empty } from '@/components/Sheet';
import coverStyles from '@/components/BinderCover.module.css';
import { listPublicSets } from '@/lib/sets';
import ui from '@/components/ui.module.css';
import styles from './page.module.css';

export default function BrowsePage() {
  const [sets, setSets] = useState<CardSetSummary[] | null>(null);
  const [sort, setSort] = useState<'new' | 'popular'>('new');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listPublicSets(sort)
      .then((page) => setSets(page.results))
      .catch((e: Error) => setError(e.message));
  }, [sort]);

  return (
    <section>
      <div className={styles.header}>
        <div>
          <p className={ui.eyebrow}>Browse</p>
          <h1 className={ui.title}>Binders</h1>
          <p className={ui.subtitle}>Every published set, ready to open</p>
        </div>
        <div className={styles.sort} role="tablist" aria-label="Sort sets">
          {(['new', 'popular'] as const).map((s) => (
            <button
              key={s}
              type="button"
              role="tab"
              aria-selected={s === sort}
              className={`${s === sort ? ui.btnOutline : ui.btnQuiet} ${ui.btnSmall}`}
              onClick={() => setSort(s)}
            >
              {s === 'new' ? 'Newest' : 'Popular'}
            </button>
          ))}
        </div>
      </div>
      {error ? <p className={ui.error}>{error}</p> : null}
      {sets === null ? (
        <Sheet className={styles.sheet}>
          <Empty icon="binder">Loading…</Empty>
        </Sheet>
      ) : sets.length === 0 ? (
        <Sheet className={styles.sheet}>
          <Empty
            icon="binder"
            action={
              <Link className={ui.btnPrimary} href="/studio">
                Start a set
              </Link>
            }
          >
            Nothing published yet. Anything you collect can be a set, so this shelf is waiting on
            its first one.
          </Empty>
        </Sheet>
      ) : (
        <ul className={coverStyles.shelf}>
          {sets.map((s) => (
            <li key={s.id}>
              <BinderCover set={s} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

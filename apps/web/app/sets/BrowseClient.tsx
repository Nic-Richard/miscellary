'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { CardSetSummary } from '@miscellary/shared';
import PageHeader from '@/components/PageHeader';
import SearchField from '@/components/SearchField';
import SetTile from '@/components/SetTile';
import Sheet, { Empty } from '@/components/Sheet';
import tileStyles from '@/components/SetTile.module.css';
import ui from '@/components/ui.module.css';
import wide from '@/components/pageWide.module.css';
import styles from './page.module.css';

export default function BrowseClient({
  newest,
  popular,
}: {
  newest: CardSetSummary[];
  popular: CardSetSummary[];
}) {
  const router = useRouter();
  const [sort, setSort] = useState<'new' | 'popular'>('new');
  const [q, setQ] = useState('');
  const sets = sort === 'new' ? newest : popular;

  return (
    <section className={wide.page}>
      <PageHeader
        title="Sets"
        description="Every published set"
        actions={
          <div className={styles.controls}>
            <SearchField
              className={styles.search}
              value={q}
              onChange={setQ}
              onSubmit={(term) => router.push(`/search?q=${encodeURIComponent(term)}`)}
              placeholder="Find a set, card or subject"
              label="Search sets, cards, subjects and users"
            />
            <div className={ui.segments} role="tablist" aria-label="Sort sets">
              {(['new', 'popular'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  role="tab"
                  aria-selected={s === sort}
                  className={`${ui.segment} ${s === sort ? ui.segmentOn : ''}`}
                  onClick={() => setSort(s)}
                >
                  {s === 'new' ? 'Newest' : 'Popular'}
                </button>
              ))}
            </div>
          </div>
        }
      />

      {sets.length === 0 ? (
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
      ) : (
        <ul className={tileStyles.grid}>
          {sets.map((s) => (
            <li key={s.id}>
              <SetTile set={s} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

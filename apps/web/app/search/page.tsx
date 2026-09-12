'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { cardCode } from '@miscellary/shared';
import type { SearchResults } from '@miscellary/shared';
import SetTile from '@/components/SetTile';
import CardPreview from '@/components/CardPreview';
import DemoBadge from '@/components/DemoBadge';
import Sheet, { Empty } from '@/components/Sheet';
import tileStyles from '@/components/SetTile.module.css';
import { search } from '@/lib/social';
import ui from '@/components/ui.module.css';
import styles from './page.module.css';

function Results() {
  const q = useSearchParams().get('q') ?? '';
  const [results, setResults] = useState<SearchResults | null>(null);

  useEffect(() => {
    if (q.trim().length < 2) return;
    search(q)
      .then(setResults)
      .catch(() => setResults(null));
  }, [q]);

  if (q.trim().length < 2)
    return (
      <section>
        <p className={ui.eyebrow}>Search</p>
        <h1 className={ui.title}>Search</h1>
        <Sheet className={styles.sheet}>
          <Empty icon="search">
            Type at least two characters. You can look for a collector, or for words in a set or
            card&rsquo;s title or description.
          </Empty>
        </Sheet>
      </section>
    );
  if (!results)
    return (
      <section>
        <p className={ui.eyebrow}>Search</p>
        <h1 className={ui.title}>&ldquo;{q}&rdquo;</h1>
        <Sheet className={styles.sheet}>
          <Empty icon="search">Searching…</Empty>
        </Sheet>
      </section>
    );
  const empty = !results.users.length && !results.sets.length && !results.cards.length;

  return (
    <section>
      <p className={ui.eyebrow}>Search</p>
      <h1 className={ui.title}>“{results.query}”</h1>
      {empty ? (
        <Sheet className={styles.sheet}>
          <Empty
            icon="search"
            action={
              <Link className={ui.btnOutline} href="/sets">
                Browse every set
              </Link>
            }
          >
            Nothing matched &ldquo;{results.query}&rdquo;. Search reads collector names, and the
            titles and descriptions of sets and cards.
          </Empty>
        </Sheet>
      ) : null}

      {results.users.length ? (
        <Sheet className={styles.sheet} title="People" meta={`${results.users.length} found`}>
          <ul className={styles.list}>
            {results.users.map((u) => (
              <li key={u.username}>
                <Link href={`/users/${u.username}`}>@{u.username}</Link>{' '}
                <span className={styles.meta}>{u.display_name}</span>
                {u.is_demo ? <DemoBadge compact /> : null}
              </li>
            ))}
          </ul>
        </Sheet>
      ) : null}

      {results.sets.length ? (
        <Sheet className={styles.sheet} title="Sets" meta={`${results.sets.length} found`}>
          <ul className={tileStyles.grid}>
            {results.sets.map((s) => (
              <li key={s.id}>
                <SetTile set={s} meta={`${s.card_count} cards · @${s.creator.username}`} />
              </li>
            ))}
          </ul>
        </Sheet>
      ) : null}

      {results.cards.length ? (
        <Sheet className={styles.sheet} title="Cards" meta={`${results.cards.length} found`}>
          <div className={styles.grid}>
            {results.cards.map((c) => (
              <Link key={c.id} href={`/sets/${c.set_slug}`} className={styles.cardLink}>
                <CardPreview
                  size="small"
                  title={c.title}
                  rarity={c.rarity}
                  code={cardCode(c.printed_set_code, c.position, c.set_total)}
                  printedText={c.printed_text}
                  imageUrl={c.image.url}
                  templateKey={c.template_key}
                  templateConfig={c.template_config}
                  render={c.render}
                />
                <span className={styles.meta}>{c.set_title}</span>
              </Link>
            ))}
          </div>
        </Sheet>
      ) : null}
    </section>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={null}>
      <Results />
    </Suspense>
  );
}

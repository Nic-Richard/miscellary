'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { CardSetSummary } from '@miscellary/shared';
import { followSet } from '@/lib/social';
import PackStage from './PackStage';
import ui from './ui.module.css';
import styles from './StartShelf.module.css';

export default function StartShelf({
  sets,
  onDone,
}: {
  sets: CardSetSummary[];
  onDone: () => void;
}) {
  const [followed, setFollowed] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  async function toggle(slug: string) {
    if (pending.has(slug)) return;
    const next = !followed.has(slug);
    const flip = (on: boolean) =>
      setFollowed((current) => {
        const copy = new Set(current);
        if (on) copy.add(slug);
        else copy.delete(slug);
        return copy;
      });
    flip(next);
    setPending((current) => new Set(current).add(slug));
    setError(null);
    try {
      await followSet(slug, next);
    } catch (e) {
      flip(!next);
      setError(e instanceof Error ? e.message : 'Could not follow that set.');
    } finally {
      setPending((current) => {
        const copy = new Set(current);
        copy.delete(slug);
        return copy;
      });
    }
  }

  return (
    <div className={styles.root}>
      <p className={styles.lead}>
        Every set you follow gives you a free pack each day. Pick a few to start your collection.
      </p>

      <ul className={styles.shelf}>
        {sets.map((set) => {
          const on = followed.has(set.slug);
          return (
            <li key={set.id}>
              <button
                type="button"
                className={`${styles.pick} ${on ? styles.on : ''}`}
                aria-pressed={on}
                onClick={() => void toggle(set.slug)}
              >
                <span className={styles.pack}>
                  <PackStage set={set} />
                </span>
                <span className={styles.name}>{set.title}</span>
                <span className={styles.meta}>{on ? 'Following' : `${set.card_count} cards`}</span>
              </button>
            </li>
          );
        })}
      </ul>

      {error ? <p className={ui.error}>{error}</p> : null}

      <div className={styles.foot}>
        <button
          type="button"
          className={ui.btnPrimary}
          disabled={followed.size === 0}
          onClick={onDone}
        >
          See my packs
        </button>
        <Link href="/sets" className={ui.btnQuiet}>
          Browse every set
        </Link>
      </div>
    </div>
  );
}

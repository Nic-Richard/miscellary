'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { SET_TITLE_MAX_LENGTH } from '@miscellary/shared';
import type { CardSetSummary } from '@miscellary/shared';
import PageHeader from '@/components/PageHeader';
import { Empty } from '@/components/Sheet';
import SetTile from '@/components/SetTile';
import tileStyles from '@/components/SetTile.module.css';
import { useAuth } from '@/lib/auth';
import { useRequireAccount } from '@/lib/requireAccount';
import { createSet, listMySets } from '@/lib/sets';
import ui from '@/components/ui.module.css';
import wide from '@/components/pageWide.module.css';
import styles from './page.module.css';

export default function StudioPage() {
  const { user, loading } = useAuth();
  useRequireAccount();
  const router = useRouter();
  const [sets, setSets] = useState<CardSetSummary[] | null>(null);
  const [title, setTitle] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    listMySets()
      .then(setSets)
      .catch((e: Error) => setError(e.message));
  }, [user]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const set = await createSet({ title, description: '' });
      router.push(`/studio/${set.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the set.');
    }
  }

  if (loading) return <p className={ui.muted}>Loading…</p>;
  if (!user) return <p className={ui.muted}>Taking you to create an account…</p>;

  return (
    <section className={wide.page}>
      <PageHeader title="Studio" description="Your sets. Drafts stay private until you publish." />

      <form className={`${ui.ticket} ${styles.create}`} onSubmit={onCreate}>
        <label className={ui.label} htmlFor="new-set-title">
          Start a new set
        </label>
        <div className={styles.createRow}>
          <input
            id="new-set-title"
            className={ui.input}
            placeholder="Set title, e.g. Rocks from the backyard"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={SET_TITLE_MAX_LENGTH}
            required
          />
          <button className={ui.btnPrimary} type="submit">
            Create draft
          </button>
        </div>
      </form>
      {error ? <p className={ui.error}>{error}</p> : null}

      {sets?.length === 0 ? (
        <Empty icon="binder">
          Name a set above to start a draft. Add cards, design its pack, and publish it when every
          card is ready. Drafts stay private until then.
        </Empty>
      ) : null}
      <ul className={tileStyles.grid}>
        {sets?.map((s) => (
          <li key={s.id} className={styles.item}>
            <SetTile
              set={s}
              href={`/studio/${s.id}`}
              meta={`${s.card_count} ${s.card_count === 1 ? 'card' : 'cards'}`}
            />
            {s.status !== 'draft' ? (
              <Link href={`/sets/${s.slug}`} className={styles.viewLink}>
                View binder
              </Link>
            ) : (
              <span className={`${styles.statusTag} ${styles.draft}`}>Draft</span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

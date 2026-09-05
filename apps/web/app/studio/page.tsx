'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import type { CardSetSummary } from '@miscellary/shared';
import BinderCover from '@/components/BinderCover';
import coverStyles from '@/components/BinderCover.module.css';
import { useAuth } from '@/lib/auth';
import { createSet, listMySets } from '@/lib/sets';
import ui from '@/components/ui.module.css';
import styles from './page.module.css';

export default function StudioPage() {
  const { user, loading } = useAuth();
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
  if (!user)
    return (
      <p className={ui.muted}>
        <Link href="/login">Log in</Link> to create sets.
      </p>
    );

  return (
    <section>
      <p className={ui.eyebrow}>Studio</p>
      <h1 className={ui.title}>Your sets</h1>
      <p className={ui.subtitle}>Drafts stay private until you publish</p>

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
            maxLength={80}
            required
          />
          <button className={ui.btnPrimary} type="submit">
            Create draft
          </button>
        </div>
      </form>
      {error ? <p className={ui.error}>{error}</p> : null}

      {sets?.length === 0 ? <p className={ui.muted}>No sets yet.</p> : null}
      <ul className={coverStyles.shelf}>
        {sets?.map((s) => (
          <li key={s.id} className={styles.item}>
            <BinderCover
              set={s}
              href={`/studio/${s.id}`}
              meta={`${s.card_count} cards · ${s.status}`}
            />
            {s.status !== 'draft' ? (
              <Link href={`/sets/${s.slug}`} className={styles.viewLink}>
                View binder →
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

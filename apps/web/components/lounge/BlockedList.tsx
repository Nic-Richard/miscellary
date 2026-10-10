'use client';

import { useEffect, useState } from 'react';
import type { Creator } from '@miscellary/shared';
import Avatar from '@/components/Avatar';
import PersonLink from '@/components/PersonLink';
import { apiFetch } from '@/lib/api';
import ui from '@/components/ui.module.css';
import styles from './Lounge.module.css';

export default function BlockedList({
  onClose,
  onChange,
}: {
  onClose: () => void;
  onChange: () => void;
}) {
  const [people, setPeople] = useState<Creator[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void apiFetch<Creator[]>('/api/v1/me/lounge-blocks/', { signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted) setPeople(data);
      })
      .catch((err: unknown) => {
        if (!controller.signal.aborted)
          setError(err instanceof Error ? err.message : 'Could not load blocked collectors.');
      });
    return () => controller.abort();
  }, []);

  async function unblock(username: string) {
    setBusy(username);
    setError(null);
    try {
      await apiFetch(`/api/v1/me/lounge-blocks/${username}/`, { method: 'DELETE' });
      setPeople((current) => current?.filter((person) => person.username !== username) ?? null);
      onChange();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not unblock that collector.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className={styles.paneScroll}>
      <div className={styles.form}>
        <button type="button" className={styles.back} onClick={onClose}>
          <span aria-hidden="true">←</span> All discussions
        </button>
        <h2>Blocked collectors</h2>
        <p className={ui.muted}>
          Blocking hides each other&rsquo;s Lounge posts, replies and likes. Trading, comments and
          follows stay the same.
        </p>
        {error && (
          <p role="alert" className={ui.error}>
            {error}
          </p>
        )}
        {!people && !error && <p className={ui.muted}>Loading…</p>}
        {people?.length === 0 && <p>You haven&rsquo;t blocked anyone.</p>}
        {people?.map((person) => (
          <div key={person.username} className={styles.tools}>
            <PersonLink person={person} className={styles.who}>
              <Avatar person={person} size={28} />@{person.username}
            </PersonLink>
            <button
              type="button"
              className={ui.btnQuiet}
              disabled={busy === person.username}
              onClick={() => void unblock(person.username)}
            >
              Unblock
            </button>
          </div>
        ))}
        <div className={styles.formActions}>
          <button type="button" className={ui.btnQuiet} onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

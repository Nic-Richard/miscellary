'use client';

import { useEffect, useState } from 'react';
import type { Creator } from '@miscellary/shared';
import { BLOCK_COPY } from '@miscellary/shared';
import Avatar from '@/components/Avatar';
import PersonLink from '@/components/PersonLink';
import { listBlocked, setBlocked } from '@/lib/social';
import ui from '@/components/ui.module.css';
import styles from './BlockedPeople.module.css';

export default function BlockedPeople({
  onChange,
  explain = true,
}: {
  onChange?: () => void;
  explain?: boolean;
}) {
  const [people, setPeople] = useState<Creator[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void listBlocked(controller.signal)
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
      await setBlocked(username, false);
      setPeople((current) => current?.filter((person) => person.username !== username) ?? null);
      onChange?.();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not unblock that collector.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className={styles.blocked}>
      {explain && <p className={ui.muted}>{BLOCK_COPY.explain}</p>}
      {error && (
        <p role="alert" className={ui.error}>
          {error}
        </p>
      )}
      {!people && !error && <p className={ui.muted}>Loading…</p>}
      {people?.length === 0 && <p className={ui.muted}>{BLOCK_COPY.empty}</p>}
      {people && people.length > 0 && (
        <ul className={styles.list}>
          {people.map((person) => (
            <li key={person.username}>
              <PersonLink person={person} className={styles.who}>
                <Avatar person={person} size={28} />
                <span>
                  {person.display_name || person.username}
                  <small>@{person.username}</small>
                </span>
              </PersonLink>
              <button
                type="button"
                className={`${ui.btnQuiet} ${ui.btnSmall}`}
                disabled={busy === person.username}
                onClick={() => void unblock(person.username)}
              >
                Unblock
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { PackOpening, PackStatus } from '@miscellary/shared';
import { useAuth } from '@/lib/auth';
import { getPackStatus, openPack } from '@/lib/packs';
import PackPouch from './PackPouch';
import type { SetIdentity } from '@/lib/setIdentity';
import PackReveal from './PackReveal';
import ui from './ui.module.css';
import styles from './PackPanel.module.css';

function Arrow() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 12h15m-6-6 6 6-6 6" />
    </svg>
  );
}

function countdown(until: string, now: number): string {
  const ms = Math.max(0, new Date(until).getTime() - now);
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':');
}

export default function PackPanel({
  slug,
  title,
  identity,
}: {
  slug: string;
  title: string;
  identity: SetIdentity;
}) {
  const { user } = useAuth();
  const [status, setStatus] = useState<PackStatus | null>(null);
  const [opening, setOpening] = useState<PackOpening | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!user) return;
    getPackStatus(slug)
      .then(setStatus)
      .catch(() => setStatus(null));
  }, [slug, user]);

  useEffect(() => {
    if (!status || status.free_available) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [status]);

  async function open(usePoints: boolean) {
    setBusy(true);
    setError(null);
    try {
      const result = await openPack(slug, usePoints);
      setOpening(result);
      setStatus(result.status);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not open the pack.');
    } finally {
      setBusy(false);
    }
  }

  const packSize = status?.pack_size ?? 10;
  const pouch = (
    <div className={styles.pouch}>
      <PackPouch title={title} identity={identity} />
    </div>
  );

  if (!user)
    return (
      <div className={styles.root}>
        <div className={`${ui.ticket} ${styles.ticket}`}>
          <h2 className={styles.heading}>Open a pack</h2>
          <p className={styles.sub}>{packSize} cards per pack</p>
          <Link href="/login" className={`${ui.btnPrimary} ${styles.cta}`}>
            Log in
            <Arrow />
          </Link>
          <p className={styles.note}>One free pack from every set, every day</p>
        </div>
        {pouch}
      </div>
    );
  if (!status) return null;

  const canBuy = status.points >= status.pack_cost;

  return (
    <>
      <div className={styles.root}>
        <div className={`${ui.ticket} ${styles.ticket}`}>
          <h2 className={styles.heading}>Open a pack</h2>
          <p className={styles.sub}>{status.pack_size} cards per pack</p>
          {status.free_available ? (
            <button
              className={`${ui.btnPrimary} ${styles.cta}`}
              type="button"
              disabled={busy}
              onClick={() => void open(false)}
            >
              Open pack
              <Arrow />
            </button>
          ) : (
            <button
              className={`${ui.btnPrimary} ${styles.cta}`}
              type="button"
              disabled={busy || !canBuy}
              onClick={() => void open(true)}
              title={canBuy ? undefined : `Needs ${status.pack_cost} set points`}
            >
              Extra pack · {status.pack_cost} pts
              <Arrow />
            </button>
          )}
          <p className={styles.note}>
            {status.free_available ? (
              <>Free pack ready · {status.points} set points</>
            ) : (
              <>Next free pack in {countdown(status.resets_at, now)}</>
            )}
          </p>
          {status.free_available ? (
            <button
              className={styles.pointsBtn}
              type="button"
              disabled={busy || !canBuy}
              onClick={() => void open(true)}
            >
              or spend {status.pack_cost} points on an extra pack
            </button>
          ) : (
            <span className={styles.pointsBtn}>
              {status.points} set points · <Link href={`/collection?set=${slug}`}>your cards</Link>
            </span>
          )}
          {error ? <p className={ui.error}>{error}</p> : null}
        </div>
        {pouch}
      </div>
      {opening ? <PackReveal opening={opening} onClose={() => setOpening(null)} /> : null}
    </>
  );
}

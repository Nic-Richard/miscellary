'use client';

import { useEffect, useRef, useState } from 'react';
import type { PackPayment, PaidPackQuote } from '@miscellary/shared';
import { packOdds, packPrice, starAmount } from '@miscellary/shared';
import { useAuth } from '@/lib/auth';
import { refreshMembership, useMembership } from '@/lib/membership';
import { getPackStatus } from '@/lib/packs';
import Link from 'next/link';
import ui from './ui.module.css';
import styles from './ExtraPackAction.module.css';

export default function ExtraPackAction({
  slug,
  points,
  packCost,
  busy,
  onOpen,
}: {
  slug: string;
  points: number;
  packCost: number;
  busy: boolean;
  onOpen: (payment: PackPayment) => Promise<boolean>;
}) {
  const { user } = useAuth();
  const { tickets } = useMembership();
  // Set points are spent first and each missing point costs one ticket.
  const needed = Math.max(0, packCost - points);
  const short = needed > tickets;
  const [quote, setQuote] = useState<PaidPackQuote | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [attempt, setAttempt] = useState<PackPayment | null>(null);
  const request = useRef<AbortController | null>(null);
  const sending = useRef(false);

  useEffect(() => {
    setQuote(null);
    setAttempt(null);
    setError(null);
    setLoading(false);
    return () => request.current?.abort();
  }, [slug, user?.id]);

  async function show() {
    if (busy || loading) return;
    const controller = new AbortController();
    request.current?.abort();
    request.current = controller;
    setLoading(true);
    setError(null);
    try {
      const status = await getPackStatus(slug, controller.signal);
      if (!controller.signal.aborted) {
        setQuote(status.paid_quote ?? null);
        if (!status.paid_quote) setError('Extra pack options are not available yet.');
      }
    } catch (err) {
      if (!controller.signal.aborted)
        setError(err instanceof Error ? err.message : 'Could not load pack options.');
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }

  async function confirm(payment: PackPayment) {
    if (busy || sending.current) return;
    sending.current = true;
    setAttempt(payment);
    try {
      if (await onOpen(payment)) {
        setQuote(null);
        setAttempt(null);
        refreshMembership();
      }
    } finally {
      sending.current = false;
    }
  }

  return (
    <div className={styles.root}>
      {quote ? (
        <div className={styles.options}>
          <p>Extra pack · {packPrice(quote)}</p>
          <p className={styles.note}>
            You have {starAmount(quote.star_units, quote.units_per_star)} tickets. Set points are
            used first.
          </p>
          <p className={styles.note}>
            Per-card odds: {packOdds(quote)}. Cards are drawn independently; duplicates are
            possible.
          </p>
          <div className={styles.buttons}>
            {attempt ? (
              <button
                type="button"
                className={ui.btnPrimary}
                disabled={busy}
                onClick={() => void confirm(attempt)}
              >
                Retry opening
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className={ui.btnPrimary}
                  disabled={busy || quote.star_units < quote.stars_spent_units}
                  onClick={() =>
                    void confirm({
                      payment: 'stars',
                      request_key: quote.request_key,
                      max_stars_units: quote.stars_spent_units,
                    })
                  }
                >
                  Spend {packPrice(quote)}
                </button>
                {quote.bonus_packs_remaining > 0 ? (
                  <button
                    type="button"
                    className={ui.btnOutline}
                    disabled={busy}
                    onClick={() =>
                      void confirm({ payment: 'bonus', request_key: quote.request_key })
                    }
                  >
                    Use monthly pack ({quote.bonus_packs_remaining} left)
                  </button>
                ) : null}
              </>
            )}
            <button
              type="button"
              className={ui.btnQuiet}
              disabled={busy}
              onClick={() => {
                setQuote(null);
                setAttempt(null);
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className={styles.offer}>
          <button
            type="button"
            className={ui.btnOutline}
            disabled={busy || loading || short}
            onClick={() => void show()}
          >
            {loading
              ? 'Loading…'
              : needed
                ? `Open with ${needed} ${needed === 1 ? 'ticket' : 'tickets'}`
                : 'Open with set points'}
          </button>
          {short && (
            <span className={styles.short}>
              You have {Math.max(0, tickets)}. <Link href="/membership">Get tickets</Link>
            </span>
          )}
        </div>
      )}
      {error ? (
        <p role="alert" className={ui.error}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { Membership } from '@miscellary/shared';
import { starAmount } from '@miscellary/shared';
import { ApiRequestError, apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import Sheet from './Sheet';
import ui from './ui.module.css';
import styles from './MembershipPanel.module.css';

export default function MembershipPanel() {
  const { user } = useAuth();
  const [membership, setMembership] = useState<Membership | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const [returned, setReturned] = useState(false);
  const [refreshing, setRefreshing] = useState(true);
  const requests = useRef<Record<string, string>>({});
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    requests.current = {};
    setMembership(null);
    setBusy(null);
    setPurchaseError(null);
    setReturned(new URLSearchParams(window.location.search).get('checkout') === 'returned');
    return () => controllerRef.current?.abort();
  }, [user?.id]);

  async function checkout(product?: string) {
    if (controllerRef.current && !controllerRef.current.signal.aborted) return;
    const controller = new AbortController();
    controllerRef.current = controller;
    setBusy(product ?? 'manage');
    setPurchaseError(null);
    try {
      let body: { product: string; request_key: string } | undefined;
      if (product) {
        const pending = membership?.pending_checkouts?.find((item) => item.product === product);
        const key = (requests.current[product] ??= pending?.request_key ?? crypto.randomUUID());
        body = { product, request_key: key };
      }
      const result = await apiFetch<{ url: string }>(
        `/api/v1/me/billing/${product ? 'checkout' : 'portal'}/`,
        { method: 'POST', ...(body ? { body } : {}), signal: controller.signal },
      );
      if (!controller.signal.aborted) window.location.assign(result.url);
    } catch (err: unknown) {
      if (!controller.signal.aborted) {
        setPurchaseError(err instanceof Error ? err.message : 'Checkout could not open.');
        if (product && err instanceof ApiRequestError && err.status === 400) {
          delete requests.current[product];
          setRetry((value) => value + 1);
        }
      }
    } finally {
      controller.abort();
      if (controllerRef.current === controller) setBusy(null);
    }
  }

  async function toggleBadge() {
    if (
      !membership ||
      busy !== null ||
      (controllerRef.current && !controllerRef.current.signal.aborted)
    )
      return;
    const controller = new AbortController();
    controllerRef.current = controller;
    setBusy('badge');
    setPurchaseError(null);
    try {
      const updated = await apiFetch<Membership>('/api/v1/me/membership/', {
        method: 'PATCH',
        body: { show_badge: membership.show_badge === false },
        signal: controller.signal,
      });
      if (!controller.signal.aborted) setMembership(updated);
    } catch (err: unknown) {
      if (!controller.signal.aborted)
        setPurchaseError(err instanceof Error ? err.message : 'Could not save badge preference.');
    } finally {
      controller.abort();
      if (controllerRef.current === controller) setBusy(null);
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    setRefreshing(true);
    setError(null);
    if (user)
      void apiFetch<Membership>('/api/v1/me/membership/', { signal: controller.signal })
        .then((data) => {
          if (!controller.signal.aborted) setMembership(data);
        })
        .catch((err: unknown) => {
          if (
            !controller.signal.aborted &&
            !(err instanceof ApiRequestError && err.status === 404)
          ) {
            setError(err instanceof Error ? err.message : 'Could not load membership.');
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) setRefreshing(false);
        });
    return () => controller.abort();
  }, [user?.id, retry]);

  if (error && !membership)
    return (
      <div className={styles.panel}>
        <p role="alert" className={ui.error}>
          {error}
        </p>
        <button
          type="button"
          className={ui.btnQuiet}
          onClick={() => setRetry((value) => value + 1)}
        >
          Retry membership
        </button>
      </div>
    );
  if (!membership)
    return refreshing && user ? (
      <Sheet title="Stars & membership" className={styles.membership}>
        <p role="status" className={ui.muted}>
          Loading membership…
        </p>
      </Sheet>
    ) : null;
  if (!membership.enabled) return null;
  const sub = membership.subscription;
  const publications = membership.publishing;
  return (
    <Sheet title="Stars & membership" className={styles.membership}>
      {membership.preview && (
        <p className={styles.notice} role="status">
          Local preview. Purchases are disabled; these are sample benefits.
        </p>
      )}
      {returned && (
        <p role="status" className={styles.note}>
          Your balance updates after payment confirmation. Refresh below if it has not arrived yet.
        </p>
      )}
      {error && (
        <p role="alert" className={ui.error}>
          {error}
        </p>
      )}
      <div className={styles.section}>
        <div className={styles.heading}>
          <div>
            <h3>Supporter membership</h3>
            <p className={styles.note}>
              A little extra for your collection. A little support for Miscellary.
            </p>
          </div>
          <span className={styles.status}>
            {sub.active ? 'Active supporter' : 'Free collector'}
          </span>
        </div>
        {sub.active ? (
          <p className={styles.note}>
            {sub.auto_renews ? 'Renews' : 'Benefits end'}{' '}
            {sub.paid_through
              ? new Date(sub.paid_through).toLocaleDateString()
              : 'at the end of your paid period'}
            .{!sub.auto_renews && ' Renewal is cancelled. You keep your Stars afterward.'}
          </p>
        ) : (
          <p className={styles.price}>
            {price(sub.price_cents, sub.currency)} <span>/ month</span>
          </p>
        )}
        {sub.active && (
          <p className={styles.note}>{price(sub.price_cents, sub.currency)} / month</p>
        )}
        <ul className={styles.perks}>
          <li>
            <b>{sub.monthly_bonus_packs} bonus packs</b>
            <span>Each paid month, across any sets. Daily free packs stay unchanged.</span>
            {sub.active && (
              <Link href="/packs" className={ui.link}>
                {sub.bonus_packs_remaining} left · Open a pack
              </Link>
            )}
          </li>
          <li>
            <b>{sub.monthly_stars} Stars</b>
            <span>Each paid month. Any set, no expiry.</span>
          </li>
          <li>
            <b>10 published sets a month</b>
            <span>Instead of 3. Existing sets stay published after expiry.</span>
            <Link href="/studio" className={ui.link}>
              Open Studio
            </Link>
          </li>
          <li>
            <b>More room to show your collection</b>
            <span>6 cards per post, together or in a binder.</span>
            <Link href="/lounge" className={ui.link}>
              Visit the Lounge
            </Link>
          </li>
          <li>
            <b>Detailed creator stats</b>
            <span>Activity, collection progress and Stars earned.</span>
            <Link href="/studio" className={ui.link}>
              View stats
            </Link>
          </li>
          <li>
            <b>A supporter badge</b>
            <span>On your profile and Lounge posts. Optional.</span>
          </li>
        </ul>
        {!sub.active && (sub.checkout_available || membership.preview) && (
          <div>
            <button
              type="button"
              className={ui.btnPrimary}
              disabled={busy !== null || !sub.checkout_available}
              onClick={() => void checkout('subscription')}
            >
              {busy === 'subscription'
                ? 'Opening checkout…'
                : `Subscribe · ${price(sub.price_cents, sub.currency)} / month`}
            </button>
            <p className={styles.note}>
              Renews monthly until cancelled. Benefits last through your paid period.
            </p>
          </div>
        )}
        {sub.management_available && (
          <button
            type="button"
            className={ui.btnQuiet}
            disabled={busy !== null}
            onClick={() => void checkout()}
          >
            {busy === 'manage' ? 'Opening…' : 'Manage website purchases'}
          </button>
        )}
        {sub.active && (
          <label className={styles.badgeToggle}>
            <input
              type="checkbox"
              checked={membership.show_badge !== false}
              disabled={busy !== null}
              onChange={() => void toggleBadge()}
            />
            Show supporter badge on my profile and in the Lounge
          </label>
        )}
      </div>
      <div className={styles.section}>
        <div className={styles.heading}>
          <div>
            <h3>Stars</h3>
            <p className={styles.note}>Your balance, available on any set.</p>
          </div>
          <p className={styles.balance}>
            {starAmount(membership.star_units, membership.units_per_star)} <span>Stars</span>
          </p>
        </div>
        <p className={styles.note}>
          Extra packs cost 50 points. A set's recycled points are used first, then your Stars cover
          the rest.
        </p>
        {membership.preview || membership.bundles.some((bundle) => bundle.checkout_available) ? (
          <>
            <div className={styles.bundles}>
              {membership.bundles
                .filter((bundle) => bundle.checkout_available || membership.preview)
                .map((bundle) => (
                  <button
                    key={bundle.id}
                    type="button"
                    className={styles.bundle}
                    disabled={busy !== null || !bundle.checkout_available}
                    onClick={() => void checkout(bundle.id)}
                  >
                    <span>{bundle.total_stars.toLocaleString()} Stars</span>
                    {bundle.bonus_stars > 0 && (
                      <span className={styles.note}>Includes {bundle.bonus_stars} bonus</span>
                    )}
                    <span>
                      {busy === bundle.id
                        ? 'Opening checkout…'
                        : price(bundle.price_cents, bundle.currency)}
                    </span>
                  </button>
                ))}
            </div>
            <p className={styles.note}>
              Stars never expire and cannot be cashed out. Packs contain random cards; check each
              set’s odds before opening. Creators earn 20% of Stars spent on their sets.
            </p>
            <p className={styles.note}>
              Prices are in USD. Any applicable tax is shown at checkout.
            </p>
          </>
        ) : !sub.checkout_available && !sub.management_available ? (
          <p className={styles.note}>
            Purchases and subscription management are not available yet.
          </p>
        ) : null}
      </div>
      <div className={`${styles.section} ${styles.heading}`}>
        <div>
          <h3>Publishing this month</h3>
          <p className={styles.note}>
            {publications.used} of {publications.limit} sets published. Resets{' '}
            {new Date(publications.resets_at).toLocaleDateString(undefined, { timeZone: 'UTC' })}{' '}
            (UTC).
          </p>
        </div>
        <Link href="/studio" className={ui.btnQuiet}>
          Your sets
        </Link>
      </div>
      {purchaseError && (
        <p role="alert" className={ui.error}>
          {purchaseError}
        </p>
      )}
      <button
        type="button"
        className={ui.btnQuiet}
        disabled={busy !== null || refreshing}
        onClick={() => setRetry((value) => value + 1)}
      >
        {refreshing ? 'Refreshing…' : 'Refresh membership'}
      </button>
    </Sheet>
  );
}

function price(cents: number, currency: string): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    currencyDisplay: 'code',
  }).format(cents / 100);
}

'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { Membership } from '@miscellary/shared';
import { starAmount } from '@miscellary/shared';
import { ApiRequestError, apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';
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
      <p role="status" className={ui.muted}>
        Loading membership…
      </p>
    ) : null;
  if (!membership.enabled) return null;
  const sub = membership.subscription;
  const publications = membership.publishing;
  const name = user?.profile.display_name || user?.profile.username || '';
  const canBuy =
    membership.preview || membership.bundles.some((bundle) => bundle.checkout_available);
  const perks: { count: string; title: string; note?: string; link?: [string, string] }[] = [
    {
      count: String(sub.monthly_bonus_packs),
      title: 'Bonus packs a month',
      note: sub.active ? `${sub.bonus_packs_remaining} left` : 'Any set',
      ...(sub.active ? { link: ['/packs', 'Open one'] as [string, string] } : {}),
    },
    { count: String(sub.monthly_stars), title: 'Tickets a month', note: 'Never expire' },
    {
      count: '10',
      title: 'Sets published a month',
      note: 'Instead of 3',
      link: ['/studio', 'Studio'],
    },
    {
      count: '6',
      title: 'Cards per Lounge post',
      note: 'Instead of 1',
      link: ['/lounge', 'Lounge'],
    },
  ];
  const renewal = sub.paid_through
    ? new Date(sub.paid_through).toLocaleDateString(undefined, { dateStyle: 'long' })
    : 'at the end of your paid period';

  return (
    <div className={styles.membership}>
      {membership.preview && (
        <p className={styles.notice} role="status">
          Local preview. Purchases are switched off and these are sample benefits.
        </p>
      )}
      {returned && (
        <p role="status" className={styles.notice}>
          Your balance updates once the payment is confirmed. Refresh below if it hasn&rsquo;t
          arrived yet.
        </p>
      )}
      {error && (
        <p role="alert" className={ui.error}>
          {error}
        </p>
      )}
      <section className={styles.member} aria-labelledby="membership-title">
        <div className={styles.cardSleeve} aria-hidden="true">
          <div className={styles.card}>
            <span className={styles.cardLabel}>{sub.active ? 'Supporter' : 'Collector'}</span>
            <span className={`${styles.seal} ${sub.active ? styles.sealGold : ''}`}>
              {name.charAt(0).toUpperCase()}
            </span>
            <span className={styles.cardHandle}>@{user?.profile.username}</span>
          </div>
        </div>
        <div className={styles.detail}>
          <div className={styles.status}>
            <h2 id="membership-title">{sub.active ? 'Supporter' : 'Become a supporter'}</h2>
            {sub.active && (
              <span className={styles.state}>{sub.auto_renews ? 'Active' : 'Ending'}</span>
            )}
          </div>
          <p className={styles.lead}>
            {sub.active
              ? sub.auto_renews
                ? `Renews ${renewal} for ${price(sub.price_cents, sub.currency)}. Cancel anytime and keep it until then.`
                : `Ends ${renewal}. You keep your tickets afterwards.`
              : `${price(sub.price_cents, sub.currency)} a month. A little extra for your collection, and a little support for Miscellary.`}
          </p>
          <ul className={styles.perks}>
            {perks.map((perk) => (
              <li key={perk.title}>
                <span className={styles.perkCount}>{perk.count}</span>
                <span className={styles.perkText}>
                  {perk.title}
                  {perk.note && <small>{perk.note}</small>}
                </span>
                {perk.link && (
                  <Link href={perk.link[0]} className={styles.perkLink}>
                    {perk.link[1]}
                  </Link>
                )}
              </li>
            ))}
            <li>
              <span className={styles.perkCount}>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
                </svg>
              </span>
              <span className={styles.perkText}>Detailed creator stats</span>
              <Link href="/studio" className={styles.perkLink}>
                View
              </Link>
            </li>
            <li>
              <span className={styles.perkCount}>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z" />
                </svg>
              </span>
              <span className={styles.perkText}>
                Supporter badge
                <small>On your profile and in the Lounge</small>
              </span>
              {sub.active && (
                <label className={styles.switch}>
                  <input
                    type="checkbox"
                    role="switch"
                    checked={membership.show_badge !== false}
                    disabled={busy !== null}
                    onChange={() => void toggleBadge()}
                    aria-label="Show supporter badge"
                  />
                  <span aria-hidden="true" />
                </label>
              )}
            </li>
          </ul>
          <div className={styles.actions}>
            {!sub.active && (sub.checkout_available || membership.preview) && (
              <button
                type="button"
                className={ui.btnPrimary}
                disabled={busy !== null || !sub.checkout_available}
                onClick={() => void checkout('subscription')}
              >
                {busy === 'subscription'
                  ? 'Opening checkout…'
                  : `Subscribe for ${price(sub.price_cents, sub.currency)} a month`}
              </button>
            )}
            {sub.management_available && (
              <button
                type="button"
                className={ui.btnOutline}
                disabled={busy !== null}
                onClick={() => void checkout()}
              >
                {busy === 'manage' ? 'Opening…' : 'Manage subscription'}
              </button>
            )}
          </div>
        </div>
      </section>

      <section className={styles.wallet} aria-labelledby="stars-title">
        <div className={styles.walletHead}>
          <div>
            <h2 id="stars-title">Tickets</h2>
            <p className={styles.note}>
              Extra packs cost 50 points. A set&rsquo;s recycled points go first, then tickets cover
              the rest.
            </p>
          </div>
          <p className={styles.balance}>
            {starAmount(membership.star_units, membership.units_per_star)}
            <span>tickets</span>
          </p>
        </div>
        {membership.star_units < 0 && (
          <p className={styles.notice} role="status">
            A refunded purchase took back tickets you&rsquo;d already spent. Trading is paused until
            your balance is back to zero. Your cards stay yours.
          </p>
        )}
        {canBuy ? (
          <>
            <div className={styles.stubs}>
              {membership.bundles
                .filter((bundle) => bundle.checkout_available || membership.preview)
                .map((bundle) => (
                  <button
                    key={bundle.id}
                    type="button"
                    className={styles.stub}
                    disabled={busy !== null || !bundle.checkout_available}
                    onClick={() => void checkout(bundle.id)}
                  >
                    <span className={styles.stubStars}>
                      {bundle.total_stars.toLocaleString()} <small>tickets</small>
                    </span>
                    <span className={styles.stubBonus}>
                      {bundle.bonus_stars > 0 ? `Includes ${bundle.bonus_stars} bonus` : 'Starter'}
                    </span>
                    <span className={styles.stubPrice}>
                      {busy === bundle.id
                        ? 'Opening checkout…'
                        : price(bundle.price_cents, bundle.currency)}
                    </span>
                  </button>
                ))}
            </div>
            <p className={styles.note}>
              Tickets never expire and can&rsquo;t be cashed out. Packs hold random cards, so check
              each set&rsquo;s odds before opening. Creators earn 20% of the tickets spent on their
              sets. Prices are in USD, and any tax is shown at checkout.
            </p>
          </>
        ) : !sub.checkout_available && !sub.management_available ? (
          <p className={styles.note}>Buying tickets isn&rsquo;t available yet.</p>
        ) : null}
      </section>

      <section className={styles.row}>
        <div>
          <h2>Publishing this month</h2>
          <p className={styles.note}>
            {publications.used} of {publications.limit} sets published. Resets{' '}
            {new Date(publications.resets_at).toLocaleDateString(undefined, {
              timeZone: 'UTC',
              dateStyle: 'long',
            })}
            .
          </p>
        </div>
        <Link href="/studio" className={ui.btnQuiet}>
          Your sets
        </Link>
      </section>

      {purchaseError && (
        <p role="alert" className={ui.error}>
          {purchaseError}
        </p>
      )}
      <button
        type="button"
        className={`${ui.btnQuiet} ${ui.btnSmall} ${styles.refresh}`}
        disabled={busy !== null || refreshing}
        onClick={() => setRetry((value) => value + 1)}
      >
        {refreshing ? 'Refreshing…' : 'Refresh'}
      </button>
    </div>
  );
}

function price(cents: number, currency: string): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    currencyDisplay: 'code',
  }).format(cents / 100);
}

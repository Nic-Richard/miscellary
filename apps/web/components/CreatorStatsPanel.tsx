'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { CreatorStats } from '@miscellary/shared';
import { creatorActivity, OPENING_LABELS, starAmount } from '@miscellary/shared';
import { ApiRequestError, apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import ui from './ui.module.css';
import Sheet from './Sheet';
import PublishingNotice from './PublishingNotice';
import styles from './CreatorStatsPanel.module.css';

export default function CreatorStatsPanel() {
  const { user } = useAuth();
  const [stats, setStats] = useState<CreatorStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [loading, setLoading] = useState(true);
  useEffect(() => setStats(null), [user?.id]);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    if (user)
      void apiFetch<CreatorStats>('/api/v1/me/creator-stats/', { signal: controller.signal })
        .then((data) => {
          if (!controller.signal.aborted) setStats(data);
        })
        .catch((err: unknown) => {
          if (
            !controller.signal.aborted &&
            !(err instanceof ApiRequestError && err.status === 404)
          ) {
            setError(err instanceof Error ? err.message : 'Could not load creator stats.');
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    return () => controller.abort();
  }, [user?.id, retry]);
  if (!user || (!loading && !stats?.enabled && !error)) return null;
  const details = stats?.details;
  const activity = details ? creatorActivity(details) : [];
  const peak = Math.max(1, ...activity.map((day) => day.openings));
  return (
    <Sheet title="Creator stats" className={styles.panel}>
      {error && (
        <p role="alert" className={ui.error}>
          {error}
        </p>
      )}
      {stats?.enabled ? (
        <>
          <dl className={styles.totals}>
            {[
              ['Published sets', stats.totals.sets],
              ['Packs opened', stats.totals.openings],
              ['Collectors', stats.totals.collectors],
              ['Current follows', stats.totals.follows],
            ].map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value!.toLocaleString()}</dd>
              </div>
            ))}
          </dl>
          <PublishingNotice allowance={stats.publishing} />
          {details && (
            <details className={styles.section}>
              <summary className={ui.link}>View detailed stats</summary>
              <div className={styles.section}>
                <h3>Last 30 days</h3>
                <p className={ui.muted}>
                  {details.recent_openings.toLocaleString()} packs opened ·{' '}
                  {starAmount(details.recent_stars_earned_units, 1000)} Stars earned
                </p>
                {details.recent_openings > 0 ? (
                  <>
                    <div
                      className={styles.chart}
                      role="img"
                      aria-label={activity
                        .map(({ day, openings }) => `${day}: ${openings} packs`)
                        .join('; ')}
                    >
                      {activity.map(({ day, openings }) => (
                        <span
                          key={day}
                          title={`${day}: ${openings} packs`}
                          style={{ height: `${Math.max(2, (openings / peak) * 100)}%` }}
                        />
                      ))}
                    </div>
                    <div className={styles.chartDates} aria-hidden="true">
                      <span>{activity[0]?.day}</span>
                      <span>{activity.at(-1)?.day}</span>
                    </div>
                  </>
                ) : (
                  <p className={ui.muted}>
                    Daily activity will appear here when your packs are opened.
                  </p>
                )}
              </div>
              <div className={styles.section}>
                <h3>Pack openings</h3>
                {details.opening_types.length ? (
                  <dl className={styles.types}>
                    {details.opening_types.map((type) => (
                      <div key={type.kind}>
                        <dt>{OPENING_LABELS[type.kind] ?? type.kind}</dt>
                        <dd>{type.openings.toLocaleString()}</dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  <p className={ui.muted}>No packs opened yet.</p>
                )}
                <p className={ui.muted}>
                  {starAmount(details.stars_earned_units, 1000)} Stars earned overall
                </p>
              </div>
              {details.sets.length > 0 && (
                <div className={styles.section}>
                  <h3>Your sets</h3>
                  <ul className={styles.list}>
                    {details.sets.map((set) => (
                      <li key={set.id}>
                        <Link
                          className={ui.link}
                          href={set.deleted ? `/studio/${set.id}` : `/sets/${set.slug}`}
                        >
                          {set.title}
                        </Link>
                        {set.deleted && <span className={ui.muted}> · Removed</span>}
                        <p className={ui.muted}>
                          {set.openings.toLocaleString()} packs · {set.collectors.toLocaleString()}{' '}
                          collectors · {set.follows.toLocaleString()} follows ·{' '}
                          {starAmount(set.stars_earned_units, 1000)} Stars earned
                        </p>
                        <p className={ui.muted}>
                          {set.holders.toLocaleString()} current collectors ·{' '}
                          {set.completed.toLocaleString()} complete binders ·{' '}
                          {set.average_completion_percent}% average completion
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className={styles.section}>
                <h3>Most liked cards</h3>
                {details.popular_cards.length ? (
                  <ul className={styles.list}>
                    {details.popular_cards.map((card) => (
                      <li key={card.id}>
                        <Link
                          className={ui.link}
                          href={`/sets/${card.set_slug}/cards/${card.position + 1}`}
                        >
                          {card.title}
                        </Link>
                        <p className={ui.muted}>
                          {card.set_title} · {card.likes.toLocaleString()}{' '}
                          {card.likes === 1 ? 'like' : 'likes'}
                        </p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className={ui.muted}>
                    Card likes will appear here once collectors leave them.
                  </p>
                )}
              </div>
            </details>
          )}
          {!details && (
            <p className={ui.muted}>
              Supporters also see activity, collection progress, card likes and Stars earned.{' '}
              <Link href="/account?section=membership">View membership</Link>.
            </p>
          )}
          <p className={styles.note}>
            Counts include your own collecting. Collector totals include closed accounts; set
            follows count current followers. Completion uses cards currently held, ignoring
            duplicates.
          </p>
        </>
      ) : loading ? (
        <p className={ui.muted}>Loading creator stats…</p>
      ) : null}
      <button
        type="button"
        disabled={loading}
        className={ui.btnQuiet}
        onClick={() => setRetry((value) => value + 1)}
      >
        {loading ? 'Refreshing…' : 'Refresh stats'}
      </button>
    </Sheet>
  );
}

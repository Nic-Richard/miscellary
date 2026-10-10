'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import type { BadgeStyle, Creator, UserSummary } from '@miscellary/shared';
import { cardCode } from '@miscellary/shared';
import Avatar from '@/components/Avatar';
import CardPreview from '@/components/CardPreview';
import PersonLink from '@/components/PersonLink';
import { useAuth } from '@/lib/auth';
import { userSummary } from '@/lib/lounge';
import { setFollow } from '@/lib/social';
import ui from '@/components/ui.module.css';
import styles from './Lounge.module.css';

const OPEN_DELAY = 350;

export default function AuthorName({
  person,
  badge,
  avatarSize = 24,
  className,
}: {
  person: Creator | null;
  badge: BadgeStyle;
  avatarSize?: number;
  className?: string;
}) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [summary, setSummary] = useState<UserSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const timer = useRef<number>(0);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  if (!person) return <span className={`${styles.who} ${className ?? ''}`}>Deleted collector</span>;
  const name = person.display_name || person.username;

  function show() {
    if (!person || person.deleted) return;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      setOpen(true);
      void userSummary(person.username)
        .then(setSummary)
        .catch(() => setOpen(false));
    }, OPEN_DELAY);
  }

  function hide() {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setOpen(false), 150);
  }

  async function follow() {
    if (!summary || busy) return;
    setBusy(true);
    try {
      const result = await setFollow(summary.username, !summary.is_following);
      setSummary({
        ...summary,
        is_following: result.following,
        follower_count: result.follower_count,
      });
      void userSummary(summary.username, true);
    } finally {
      setBusy(false);
    }
  }

  const featured = summary?.featured_card;
  return (
    <span
      className={`${styles.author} ${className ?? ''}`}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      <PersonLink person={person} className={styles.who}>
        <Avatar person={person} badge={badge} size={avatarSize} />
        {name}
      </PersonLink>
      {open && summary && (
        <span className={styles.hoverCard} role="dialog" aria-label={`${name}'s profile`}>
          <span className={styles.hoverHead}>
            <Avatar person={summary} badge={summary.badge_style} size={40} />
            <span>
              <b>{summary.display_name || summary.username}</b>
              <small>Collecting since {new Date(summary.created_at).getFullYear()}</small>
            </span>
          </span>
          {featured && (
            <span className={styles.featured}>
              <span className={styles.featuredCard}>
                <CardPreview
                  title={featured.title}
                  rarity={featured.rarity}
                  imageUrl={featured.image?.url ?? null}
                  templateKey={featured.template_key}
                  templateConfig={featured.template_config}
                  code={cardCode(featured.printed_set_code, featured.position, featured.set_total)}
                  printedText={featured.printed_text}
                  render={featured.render}
                  previewThumbnail
                  renderMode="flat"
                />
              </span>
              <span>
                <small>Featured card</small>
                <b>{featured.title}</b>
                <small>{featured.set_title}</small>
              </span>
            </span>
          )}
          <span className={styles.hoverStats}>
            <span>
              <b>{summary.card_count}</b> cards
            </span>
            <span>
              <b>{summary.set_count}</b> sets
            </span>
            <span>
              <b>{summary.follower_count}</b> followers
            </span>
          </span>
          {user && !summary.is_me && !summary.is_blocked && (
            <span className={styles.hoverActions}>
              <button
                type="button"
                className={`${summary.is_following ? ui.btnOutline : ui.btnPrimary} ${ui.btnSmall}`}
                disabled={busy}
                onClick={() => void follow()}
              >
                {summary.is_following ? 'Following' : 'Follow'}
              </button>
              <Link
                href={`/trades/new?with=${summary.username}`}
                className={`${ui.btnOutline} ${ui.btnSmall}`}
              >
                Offer a trade
              </Link>
            </span>
          )}
        </span>
      )}
    </span>
  );
}

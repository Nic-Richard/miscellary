'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { LoungeFeed, LoungePost, LoungeTopic, UserSummary } from '@miscellary/shared';
import { cardCode, loungeTopicLabel } from '@miscellary/shared';
import Avatar from '@/components/Avatar';
import CardPreview from '@/components/CardPreview';
import SupporterEmblem from '@/components/SupporterEmblem';
import SupporterPrompt from '@/components/SupporterPrompt';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { userSummary } from '@/lib/lounge';
import { setFollow } from '@/lib/social';
import ui from '@/components/ui.module.css';
import type { LoungeView } from './LoungeShell';
import styles from './Lounge.module.css';

const TOP_COUNT = 10;

export default function LoungeRail({
  post,
  topic,
  subscriber,
  onView,
  onStart,
}: {
  post: LoungePost | null;
  topic: LoungeTopic | '';
  subscriber: boolean;
  onView: (view: LoungeView) => void;
  onStart: () => void;
}) {
  const { user } = useAuth();
  const railTopic = post ? post.topic : topic;
  return (
    <aside className={styles.rail} aria-label="More from the Lounge">
      {post ? (
        post.author && !post.author.deleted && <AuthorCard username={post.author.username} />
      ) : (
        <section className={styles.railBox}>
          <h2 className={ui.panelTitle}>About the Lounge</h2>
          <p className={ui.muted}>
            Talk about cards, sets and trades. Keep it kind, and share only cards you own.
          </p>
          <button type="button" className={ui.btnPrimary} onClick={onStart}>
            Start a discussion
          </button>
        </section>
      )}
      <TopList
        topic={railTopic}
        window={post ? 'month' : 'week'}
        exclude={post?.id ?? null}
        title={railTopic ? `Top in ${loungeTopicLabel(railTopic)}` : 'Top this week'}
      />
      {!post && user && (
        <section className={styles.railBox}>
          <h2 className={ui.panelTitle}>Yours</h2>
          <button type="button" className={styles.railLink} onClick={() => onView('saved')}>
            Saved discussions
          </button>
          {subscriber && (
            <button type="button" className={styles.railLink} onClick={() => onView('drafts')}>
              Drafts
            </button>
          )}
        </section>
      )}
      {!post && (
        <SupporterPrompt compact>
          Supporters can fill a binder page with up to 40 cards, keep drafts and sort saves into
          folders.
        </SupporterPrompt>
      )}
    </aside>
  );
}

function TopList({
  topic,
  window,
  exclude,
  title,
}: {
  topic: LoungeTopic | '';
  window: 'week' | 'month';
  exclude: string | null;
  title: string;
}) {
  const [rows, setRows] = useState<LoungePost[] | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ sort: 'top', window });
    if (topic) params.set('topic', topic);
    setRows(null);
    void apiFetch<LoungeFeed>(`/api/v1/lounge/?${params.toString()}`, {
      signal: controller.signal,
    })
      .then((data) => {
        if (!controller.signal.aborted) setRows(data.results);
      })
      .catch(() => {
        if (!controller.signal.aborted) setRows([]);
      });
    return () => controller.abort();
  }, [topic, window]);

  const shown = (rows ?? []).filter((row) => row.id !== exclude).slice(0, TOP_COUNT);
  return (
    <section className={styles.railBox}>
      <h2 className={ui.panelTitle}>{title}</h2>
      {rows === null ? (
        <p className={ui.muted}>Loading…</p>
      ) : !shown.length ? (
        <p className={ui.muted}>Nothing here yet.</p>
      ) : (
        <ol className={styles.topList}>
          {shown.map((row) => (
            <li key={row.id}>
              <Link href={`/lounge/${row.id}`}>
                <b>{row.score}</b>
                <span className={styles.topText}>
                  <span className={styles.topTitle}>{row.title}</span>
                  <small>
                    {row.author?.display_name || row.author?.username || 'Deleted'}
                    <SupporterEmblem tier={row.author?.supporter_tier} />
                  </small>
                  <small>
                    {!topic && <>{loungeTopicLabel(row.topic)}, </>}
                    {row.reply_count} {row.reply_count === 1 ? 'reply' : 'replies'}
                  </small>
                </span>
                <MiniFan cards={row.cards} />
              </Link>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function MiniFan({ cards }: { cards: LoungePost['cards'] }) {
  const shown = cards.filter((card) => card !== null).slice(0, 3);
  if (!shown.length) return <span />;
  return (
    <span className={styles.miniFan} aria-hidden="true">
      {shown.map((card) => (
        <span key={card.id}>
          <CardPreview
            title={card.title}
            rarity={card.rarity}
            imageUrl={card.image?.url ?? null}
            templateKey={card.template_key}
            templateConfig={card.template_config}
            code={cardCode(card.printed_set_code, card.position, card.set_total)}
            printedText={card.printed_text}
            render={card.render}
            size="small"
          />
        </span>
      ))}
    </span>
  );
}

function AuthorCard({ username }: { username: string }) {
  const { user } = useAuth();
  const [person, setPerson] = useState<UserSummary | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    setPerson(null);
    void userSummary(username)
      .then((summary) => {
        if (live) setPerson(summary);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [username]);

  if (!person) return <section className={`${styles.railBox} ${styles.authorLoading}`} />;

  async function follow() {
    if (!person || busy) return;
    setBusy(true);
    try {
      const result = await setFollow(person.username, !person.is_following);
      setPerson({
        ...person,
        is_following: result.following,
        follower_count: result.follower_count,
      });
      void userSummary(person.username, true);
    } finally {
      setBusy(false);
    }
  }

  const featured = person.featured_card;
  const months = person.supporter_tier ? person.supporter_months : 0;
  return (
    <section className={`${styles.railBox} ${styles.authorCard}`} aria-label="About the author">
      <div className={styles.authorHead}>
        <Avatar person={person} badge={person.badge_style} size={56} />
        <div>
          <Link href={`/users/${person.username}`} className={styles.authorName}>
            {person.display_name || person.username}
            <SupporterEmblem tier={person.supporter_tier} months={months} large />
          </Link>
          <small>
            @{person.username}
            {months ? `, supporter for ${months} ${months === 1 ? 'month' : 'months'}` : ''}
          </small>
        </div>
      </div>
      {person.bio && (
        <div className={styles.authorSection}>
          <h3>About</h3>
          <p>{person.bio}</p>
        </div>
      )}
      {featured && (
        <div className={styles.authorSection}>
          <h3>Featured card</h3>
          <div className={styles.authorFeatured}>
            <span>
              <CardPreview
                title={featured.title}
                rarity={featured.rarity}
                imageUrl={featured.image?.url ?? null}
                templateKey={featured.template_key}
                templateConfig={featured.template_config}
                code={cardCode(featured.printed_set_code, featured.position, featured.set_total)}
                printedText={featured.printed_text}
                render={featured.render}
                size="small"
              />
            </span>
            <span>
              <b>{featured.title}</b>
              <Link href={`/sets/${featured.set_slug}`}>{featured.set_title}</Link>
            </span>
          </div>
        </div>
      )}
      <div className={styles.authorSection}>
        <h3>Collecting since {new Date(person.created_at).getFullYear()}</h3>
        <p className={styles.authorStats}>
          <span>
            <b>{person.card_count}</b> cards
          </span>
          <span>
            <b>{person.set_count}</b> sets
          </span>
          <span>
            <b>{person.follower_count}</b> followers
          </span>
        </p>
      </div>
      {user && !person.is_me && !person.is_blocked && (
        <div className={styles.authorActions}>
          <button
            type="button"
            className={person.is_following ? ui.btnOutline : ui.btnPrimary}
            disabled={busy}
            onClick={() => void follow()}
          >
            {person.is_following ? 'Following' : 'Follow'}
          </button>
          <Link href={`/trades/new?with=${person.username}`} className={ui.btnOutline}>
            Offer a trade
          </Link>
        </div>
      )}
    </section>
  );
}

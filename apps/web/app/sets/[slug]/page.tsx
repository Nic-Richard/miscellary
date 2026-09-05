'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import type { Card, CardSetDetail, OwnedCard } from '@miscellary/shared';
import Binder from '@/components/binder/Binder';
import CardGrid, { CardCell } from '@/components/CardGrid';
import FolderTabs from '@/components/binder/FolderTabs';
import CardPreview from '@/components/CardPreview';
import Comments from '@/components/Comments';
import Description from '@/components/Description';
import LikeButton from '@/components/LikeButton';
import PackPanel from '@/components/PackPanel';
import ReportButton from '@/components/ReportButton';
import { getProfile, likeCard, likeSet, setFollow } from '@/lib/social';
import { useAuth } from '@/lib/auth';
import { getPublicSet } from '@/lib/sets';
import { listMyCards, recycleCard } from '@/lib/packs';
import ui from '@/components/ui.module.css';
import SetCover from '@/components/SetCover';
import styles from './page.module.css';

const STAT_ICONS = {
  cards: 'M7 4h10v16H7ZM4 7h1v10H4Zm15 0h1v10h-1ZM10 8h4M10 11h4',
  rarities: 'm12 3 9 9-9 9-9-9Zm0 5 4 4-4 4-4-4Z',
  packs: 'M6 3h12l-1 18H7ZM8 8h8M9 17h6',
  released: 'M4 6h16v14H4ZM4 10h16M8 3v4M16 3v4',
};

function StatIcon({ name }: { name: keyof typeof STAT_ICONS }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d={STAT_ICONS[name]} />
    </svg>
  );
}

// The API returns one row per owned copy, each annotated with how many copies
// the owner holds. Collapse them so a duplicate is one tile, not several.
function stack(owned: OwnedCard[]): OwnedCard[] {
  const seen = new Map<string, OwnedCard>();
  for (const copy of owned) if (!seen.has(copy.card.id)) seen.set(copy.card.id, copy);
  return [...seen.values()];
}

export default function BinderPage() {
  const { slug } = useParams<{ slug: string }>();
  const { loading, user } = useAuth();
  const [set, setSet] = useState<CardSetDetail | null>(null);
  const [following, setFollowing] = useState<boolean | null>(null);
  const [tab, setTab] = useState<'binder' | 'all' | 'collected'>('binder');
  const tabsTop = useRef<HTMLDivElement>(null);
  const [spread, setSpread] = useState(0);
  const [owned, setOwned] = useState<OwnedCard[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Wait for auth so a creator can view their own draft binder.
  useEffect(() => {
    if (loading) return;
    getPublicSet(slug)
      .then(setSet)
      .catch((e: Error) => setError(e.message));
  }, [slug, loading]);

  useEffect(() => {
    if (!set || !user || user.profile.username === set.creator.username) return;
    getProfile(set.creator.username)
      .then((p) => setFollowing(p.is_following))
      .catch(() => setFollowing(null));
  }, [set, user]);

  useEffect(() => {
    if (tab !== 'collected' || !user || owned !== null) return;
    listMyCards(slug)
      .then((page) => setOwned(page.results))
      .catch(() => setOwned([]));
  }, [tab, user, owned, slug]);

  async function onRecycle(ownedId: string) {
    try {
      await recycleCard(ownedId);
      const page = await listMyCards(slug);
      setOwned(page.results);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not recycle.');
    }
  }

  async function toggleFollow() {
    if (!set || following === null) return;
    const result = await setFollow(set.creator.username, !following);
    setFollowing(result.following);
  }

  if (error) return <p className={ui.error}>{error}</p>;
  if (!set) return <p className={ui.muted}>Loading…</p>;

  const spreads = Array.from({ length: Math.max(1, Math.ceil(set.cards.length / 8)) }, (_, index) =>
    set.cards.slice(index * 8, index * 8 + 8),
  );
  const rarityCount = new Set(set.cards.map((c) => c.rarity)).size;
  const popularCards = [...set.cards].sort((a, b) => b.like_count - a.like_count).slice(0, 3);
  const released = set.published_at ? new Date(set.published_at).getFullYear() : null;
  const creatorName = set.creator.display_name || set.creator.username;
  const isPublished = set.status === 'published';

  // `set` is narrowed above; capture it so the closure keeps the narrowing.
  const detail = set;

  function renderCard(card: Card, number: number) {
    return (
      <div className={styles.cardCell}>
        <CardPreview
          size="small"
          title={card.title}
          rarity={card.rarity}
          number={number}
          description={card.description}
          imageUrl={card.image.url}
          templateKey={card.template_key}
          templateConfig={card.template_config}
          mark={detail.mark}
        />
        {isPublished ? (
          <div className={styles.cardSocial}>
            <LikeButton
              liked={detail.liked_card_ids.includes(card.id)}
              count={card.like_count}
              onToggle={(like) => likeCard(card.id, like)}
            />
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <section className={styles.root}>
      <div className={styles.header} id="set-overview">
        <SetCover
          url={set.cover?.url ?? null}
          fallback={set.cards[0]?.image.url ?? null}
          title={set.title}
        />

        <div className={styles.identity}>
          <p className={ui.eyebrow}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="9" />
              <path d="m8 12 3 3 5-6" />
            </svg>
            {isPublished ? 'Published set' : 'Draft preview'}
          </p>
          <h1 className={ui.title}>{set.title}</h1>
          <p className={ui.subtitle}>
            {set.card_count} {set.card_count === 1 ? 'card' : 'cards'} · {set.opening_count}{' '}
            {set.opening_count === 1 ? 'pack' : 'packs'} opened
          </p>
          {set.description ? <Description text={set.description} className={styles.desc} /> : null}
          <div className={styles.creator}>
            <span>Created by</span>
            <Link href={`/users/${set.creator.username}`} className={styles.creatorLink}>
              <span className={styles.monogram}>{creatorName[0]?.toUpperCase()}</span>
              <strong>{creatorName}</strong>
            </Link>
            {following !== null ? (
              <button
                type="button"
                className={`${following ? ui.btnOutline : ui.btnPrimary} ${ui.btnSmall}`}
                onClick={() => void toggleFollow()}
              >
                {following ? 'Following' : 'Follow'}
              </button>
            ) : null}
          </div>
        </div>

        <div className={styles.side}>
          {isPublished ? (
            <div className={styles.social}>
              <LikeButton
                liked={set.liked}
                count={set.like_count}
                onToggle={(like) => likeSet(set.slug, like)}
              />
              <ReportButton target={{ set_slug: set.slug }} />
            </div>
          ) : null}
          {isPublished ? <PackPanel slug={set.slug} title={set.title} identity={set} /> : null}
        </div>
      </div>

      <div className={styles.body}>
        <div className={styles.binderColumn}>
          <button
            type="button"
            className={styles.fit}
            onClick={() => tabsTop.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
            </svg>
            Line up binder
          </button>
          <div ref={tabsTop}>
            <FolderTabs
              label="Set sections"
              tabs={[
                {
                  label: 'Binder',
                  icon: 'binders',
                  active: tab === 'binder',
                  onSelect: () => setTab('binder'),
                },
                {
                  label: 'All cards',
                  icon: 'cards',
                  count: set.card_count,
                  active: tab === 'all',
                  onSelect: () => setTab('all'),
                },
                ...(user
                  ? [
                      {
                        label: 'Collected',
                        icon: 'overview' as const,
                        ...(owned ? { count: stack(owned).length } : {}),
                        active: tab === 'collected',
                        onSelect: () => setTab('collected'),
                      },
                    ]
                  : []),
              ]}
            />
          </div>

          {tab === 'binder' ? (
            <div className={styles.spread} id="cards">
              <Binder
                mark={set.mark}
                startIndex={spread * 8}
                slots={Array.from({ length: 8 }, (_, slotIndex) => {
                  const card = spreads[spread]?.[slotIndex];
                  if (!card) return null;
                  return renderCard(card, spread * 8 + slotIndex + 1);
                })}
              />
              {spreads.length > 1 ? (
                <div className={styles.pager}>
                  <button
                    type="button"
                    className={`${ui.btnQuiet} ${ui.btnSmall}`}
                    onClick={() => setSpread((n) => Math.max(0, n - 1))}
                    disabled={spread === 0}
                  >
                    ← Previous
                  </button>
                  <span className={styles.pageNo}>
                    Pages {spread * 2 + 1} and {spread * 2 + 2} of {spreads.length * 2}
                  </span>
                  <button
                    type="button"
                    className={`${ui.btnQuiet} ${ui.btnSmall}`}
                    onClick={() => setSpread((n) => Math.min(spreads.length - 1, n + 1))}
                    disabled={spread >= spreads.length - 1}
                  >
                    Next →
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}

          {tab === 'all' ? (
            <div className={styles.sheet}>
              <div className={styles.sheetHead}>
                <h2 className={styles.sheetTitle}>All cards</h2>
                <span className={styles.sheetMeta}>
                  {set.card_count} {set.card_count === 1 ? 'card' : 'cards'} in the set
                </span>
              </div>
              <CardGrid>
                {set.cards.map((card, i) => (
                  <CardCell key={card.id}>{renderCard(card, i + 1)}</CardCell>
                ))}
              </CardGrid>
            </div>
          ) : null}

          {tab === 'collected' ? (
            <div className={styles.sheet}>
              <div className={styles.sheetHead}>
                <h2 className={styles.sheetTitle}>Collected</h2>
                <span className={styles.sheetMeta}>
                  {owned === null
                    ? 'Loading'
                    : `${stack(owned).length} of ${set.card_count} · ${owned.length} ${
                        owned.length === 1 ? 'copy' : 'copies'
                      }`}
                </span>
              </div>
              {owned === null ? (
                <p className={styles.sheetEmpty}>Loading…</p>
              ) : owned.length === 0 ? (
                <p className={styles.sheetEmpty}>
                  You have no cards from this set yet. Open a pack to start collecting.
                </p>
              ) : (
                <CardGrid>
                  {stack(owned).map((copy) => (
                    <CardCell
                      key={copy.id}
                      footer={
                        copy.copies > 1 ? (
                          <button
                            type="button"
                            className={styles.recycle}
                            onClick={() => void onRecycle(copy.id)}
                            disabled={copy.held}
                            title={copy.held ? 'In a pending trade' : undefined}
                          >
                            ×{copy.copies} · Recycle one
                          </button>
                        ) : (
                          'Only copy'
                        )
                      }
                    >
                      {renderCard(copy.card, copy.card.position + 1)}
                    </CardCell>
                  ))}
                </CardGrid>
              )}
            </div>
          ) : null}

          {isPublished ? (
            <div className={styles.comments}>
              <Comments slug={set.slug} />
            </div>
          ) : null}
        </div>

        <aside className={styles.rail} id="about">
          <section className={ui.panel}>
            <h2 className={ui.panelTitle}>About this set</h2>
            <ul className={ui.stats}>
              <li className={ui.stat}>
                <StatIcon name="cards" />
                <b>{set.card_count}</b>
                <span>Total cards</span>
              </li>
              <li className={ui.stat}>
                <StatIcon name="rarities" />
                <b>{rarityCount}</b>
                <span>Rarities</span>
              </li>
              <li className={ui.stat}>
                <StatIcon name="packs" />
                <b>{set.opening_count}</b>
                <span>Packs opened</span>
              </li>
              {released ? (
                <li className={ui.stat}>
                  <StatIcon name="released" />
                  <b>{released}</b>
                  <span>Released</span>
                </li>
              ) : null}
            </ul>
          </section>

          {popularCards.length > 0 ? (
            <section className={ui.panel}>
              <h2 className={ui.panelTitle}>Popular pulls</h2>
              <ol className={styles.pulls}>
                {popularCards.map((card) => (
                  <li key={card.id}>
                    <img src={card.image.url} alt="" />
                    <span>
                      <strong>{card.title}</strong>
                      <small data-rarity={card.rarity}>{card.rarity}</small>
                    </span>
                    <b>
                      {card.like_count} {card.like_count === 1 ? 'like' : 'likes'}
                    </b>
                  </li>
                ))}
              </ol>
              <a className={`${ui.btnOutline} ${ui.btnWide}`} href="#cards">
                View all cards
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M4 12h15m-6-6 6 6-6 6" />
                </svg>
              </a>
            </section>
          ) : null}

          <section className={ui.panel}>
            <h2 className={ui.panelTitle}>Collector</h2>
            <p className={styles.railText}>
              {creatorName}
              {set.creator.display_name ? ` (@${set.creator.username})` : ''} keeps this set. Every
              card here is a display record; open a pack to collect your own copies.
            </p>
            <Link href={`/users/${set.creator.username}`} className={styles.railLink}>
              View creator profile →
            </Link>
          </section>
        </aside>
      </div>
    </section>
  );
}

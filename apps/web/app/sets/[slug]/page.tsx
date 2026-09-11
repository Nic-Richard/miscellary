'use client';

import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { cardCode } from '@miscellary/shared';
import type { Card, CardSetDetail, OwnedCard } from '@miscellary/shared';
import Binder from '@/components/binder/Binder';
import type { BinderPage as BinderPageData } from '@/components/binder/Binder';
import CardGrid, { CardCell } from '@/components/CardGrid';
import FolderTabs from '@/components/binder/FolderTabs';
import CardInspector from '@/components/CardInspector';
import CardPreview from '@/components/CardPreview';
import Comments from '@/components/Comments';
import Description from '@/components/Description';
import DemoBadge from '@/components/DemoBadge';
import LikeButton from '@/components/LikeButton';
import PackPanel from '@/components/PackPanel';
import ReportButton from '@/components/ReportButton';
import { getProfile, likeCard, likeSet, setFollow } from '@/lib/social';
import { useAuth } from '@/lib/auth';
import { loginHref } from '@/lib/returnTo';
import { useContinuation } from '@/lib/useContinuation';
import { getPublicSet } from '@/lib/sets';
import { listMyCards, recycleCard } from '@/lib/packs';
import ui from '@/components/ui.module.css';
import SetCover from '@/components/SetCover';
import styles from './page.module.css';

const FOLLOW_ACTION = 'follow';
const LIKE_SET_ACTION = 'like-set';
const LIKE_CARD_ACTION = 'like-card';
const LIKE_CARD_CARRIES = ['card'];

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

function SetCard({
  card,
  detail,
  published,
  onInspect,
}: {
  card: Card;
  detail: CardSetDetail;
  published: boolean;
  onInspect: (card: Card) => void;
}) {
  return (
    <div className={styles.cardCell}>
      <button
        type="button"
        className={styles.inspect}
        onClick={() => onInspect(card)}
        aria-label={`Inspect ${card.title}`}
      >
        <CardPreview
          size="small"
          title={card.title}
          rarity={card.rarity}
          code={cardCode(
            detail.printed_set_code,
            card.position,
            card.set_total || detail.cards.length,
          )}
          description={card.description}
          printedText={card.printed_text}
          imageUrl={card.image.url}
          templateKey={card.template_key}
          templateConfig={card.template_config}
          mark={detail.mark}
          render={card.render}
        />
      </button>
      {published ? (
        <div className={styles.cardSocial}>
          <LikeButton
            liked={detail.liked_card_ids.includes(card.id)}
            count={card.like_count}
            onToggle={(like) => likeCard(card.id, like)}
            action={LIKE_CARD_ACTION}
            carries={{ card: card.id }}
          />
        </div>
      ) : null}
    </div>
  );
}

function stack(owned: OwnedCard[]): OwnedCard[] {
  const seen = new Map<string, OwnedCard>();
  for (const copy of owned) {
    const current = seen.get(copy.card.id);
    if (!current || (current.held && !copy.held)) seen.set(copy.card.id, copy);
  }
  return [...seen.values()];
}

export default function BinderPage() {
  const { slug } = useParams<{ slug: string }>();
  const pathname = usePathname();
  const { loading, user } = useAuth();
  const [set, setSet] = useState<CardSetDetail | null>(null);
  const [following, setFollowing] = useState<boolean | null>(null);
  const [tab, setTab] = useState<'binder' | 'all' | 'collected'>('binder');
  const tabsTop = useRef<HTMLDivElement>(null);
  const [spread, setSpread] = useState(0);
  const [owned, setOwned] = useState<OwnedCard[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [inspect, setInspect] = useState<Card | null>(null);
  const [recycling, setRecycling] = useState<string | null>(null);
  const [gain, setGain] = useState<{ cardId: string; amount: number; key: number } | null>(null);
  const [packPoints, setPackPoints] = useState<number | undefined>();
  const preloadedImages = useRef<HTMLImageElement[]>([]);

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

  useEffect(() => {
    if (!set) return;
    const images = set.cards.map((card) => {
      const image = new window.Image();
      image.src = card.render?.thumbnail?.url ?? card.image.url;
      void image.decode?.().catch(() => undefined);
      return image;
    });
    preloadedImages.current = images;
    return () => {
      if (preloadedImages.current === images) preloadedImages.current = [];
    };
  }, [set]);

  const binderPages = useMemo<BinderPageData[]>(() => {
    if (!set) return [];
    const published = set.status === 'published';
    return Array.from({ length: Math.max(1, Math.ceil(set.cards.length / 8)) }, (_, pageIndex) => ({
      startIndex: pageIndex * 8,
      slots: Array.from({ length: 8 }, (_, slotIndex) => {
        const card = set.cards[pageIndex * 8 + slotIndex];
        return card ? (
          <SetCard
            key={card.id}
            card={card}
            detail={set}
            published={published}
            onInspect={setInspect}
          />
        ) : null;
      }),
    }));
  }, [set]);

  async function onRecycle(copy: OwnedCard) {
    setRecycling(copy.id);
    try {
      const result = await recycleCard(copy.id);
      setPackPoints(result.points);
      setOwned((current) =>
        current
          ? current
              .filter((ownedCard) => ownedCard.id !== copy.id)
              .map((ownedCard) =>
                ownedCard.card.id === copy.card.id
                  ? { ...ownedCard, copies: ownedCard.copies - 1 }
                  : ownedCard,
              )
          : current,
      );
      const nextGain = {
        cardId: copy.card.id,
        amount: result.earned,
        key: Date.now(),
      };
      setGain(nextGain);
      setTimeout(() => setGain((current) => (current?.key === nextGain.key ? null : current)), 800);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not recycle.');
    } finally {
      setRecycling(null);
    }
  }

  const toggleFollow = useCallback(async () => {
    if (!set || following === null) return;
    const result = await setFollow(set.creator.username, !following);
    setFollowing(result.following);
  }, [set, following]);

  useContinuation(FOLLOW_ACTION, () => void toggleFollow(), following === false);
  useContinuation(
    LIKE_SET_ACTION,
    () => {
      if (!set || set.liked) return;
      void likeSet(set.slug, true).then((result) =>
        setSet({ ...set, liked: result.liked, like_count: result.like_count }),
      );
    },
    Boolean(user && set),
  );
  useContinuation(
    LIKE_CARD_ACTION,
    (carried) => {
      const card = set?.cards.find((entry) => entry.id === carried.get('card'));
      if (!set || !card) return;
      setInspect(card);
      if (set.liked_card_ids.includes(card.id)) return;
      void likeCard(card.id, true).then((result) =>
        setSet({
          ...set,
          liked_card_ids: [...set.liked_card_ids, card.id],
          cards: set.cards.map((entry) =>
            entry.id === card.id ? { ...entry, like_count: result.like_count } : entry,
          ),
        }),
      );
    },
    Boolean(user && set),
    LIKE_CARD_CARRIES,
  );

  if (error) return <p className={ui.error}>{error}</p>;
  if (!set) return <p className={ui.muted}>Loading…</p>;

  const rarityCount = new Set(set.cards.map((c) => c.rarity)).size;
  const popularCards = [...set.cards].sort((a, b) => b.like_count - a.like_count).slice(0, 3);
  const released = set.published_at ? new Date(set.published_at).getFullYear() : null;
  const creatorName = set.creator.display_name || set.creator.username;
  const isPublished = set.status === 'published';

  const detail = set;

  function renderCard(card: Card) {
    return <SetCard card={card} detail={detail} published={isPublished} onInspect={setInspect} />;
  }

  function navigateSpread(direction: -1 | 1) {
    setSpread((current) => Math.max(0, Math.min(binderPages.length - 1, current + direction)));
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
              {set.creator.is_demo ? <DemoBadge compact /> : null}
            </Link>
            {following !== null ? (
              <button
                type="button"
                className={`${following ? ui.btnOutline : ui.btnPrimary} ${ui.btnSmall}`}
                onClick={() => void toggleFollow()}
              >
                {following ? 'Following' : 'Follow'}
              </button>
            ) : !user && isPublished ? (
              <Link
                href={loginHref(pathname, FOLLOW_ACTION)}
                className={`${ui.btnPrimary} ${ui.btnSmall}`}
              >
                Log in to follow
              </Link>
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
                action={LIKE_SET_ACTION}
              />
              <ReportButton target={{ set_slug: set.slug }} />
            </div>
          ) : null}
          {isPublished ? (
            <PackPanel
              slug={set.slug}
              title={set.title}
              identity={set}
              points={packPoints}
              onOpened={(opening) => {
                setPackPoints(opening.status.points);
                setOwned(null);
              }}
            />
          ) : null}
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
                colour={set.binder_colour}
                page={spread}
                startIndex={spread * 8}
                canPrevious={spread > 0}
                canNext={spread < binderPages.length - 1}
                onNavigate={navigateSpread}
                pages={binderPages}
                slots={binderPages[spread]?.slots ?? []}
              />
              {binderPages.length > 1 ? (
                <div className={styles.pager}>
                  <button
                    type="button"
                    className={`${ui.btnQuiet} ${ui.btnSmall}`}
                    onPointerDown={(event) => {
                      if (event.button === 0) navigateSpread(-1);
                    }}
                    onClick={(event) => {
                      if (event.detail === 0) navigateSpread(-1);
                    }}
                    disabled={spread === 0}
                  >
                    ← Previous
                  </button>
                  <span className={styles.pageNo}>
                    Pages {spread * 2 + 1} and {spread * 2 + 2} of {binderPages.length * 2}
                  </span>
                  <button
                    type="button"
                    className={`${ui.btnQuiet} ${ui.btnSmall}`}
                    onPointerDown={(event) => {
                      if (event.button === 0) navigateSpread(1);
                    }}
                    onClick={(event) => {
                      if (event.detail === 0) navigateSpread(1);
                    }}
                    disabled={spread >= binderPages.length - 1}
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
                {set.cards.map((card) => (
                  <CardCell key={card.id}>{renderCard(card)}</CardCell>
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
                      key={copy.card.id}
                      footer={
                        <span className={styles.recycleAnchor}>
                          {copy.copies > 1 ? (
                            <button
                              type="button"
                              className={styles.recycle}
                              onClick={() => void onRecycle(copy)}
                              disabled={copy.held || recycling === copy.id}
                              title={copy.held ? 'In a pending trade' : undefined}
                            >
                              ×{copy.copies} · Recycle one
                            </button>
                          ) : (
                            'Only copy'
                          )}
                          {gain?.cardId === copy.card.id ? (
                            <span key={gain.key} className={styles.pointGain}>
                              +{gain.amount}
                            </span>
                          ) : null}
                        </span>
                      }
                    >
                      {renderCard(copy.card)}
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

      {inspect ? (
        <CardInspector
          card={inspect}
          setTitle={set.title}
          setSlug={set.slug}
          mark={set.mark}
          packColour={set.pack_colour}
          creator={set.creator}
          onClose={() => setInspect(null)}
        />
      ) : null}
    </section>
  );
}

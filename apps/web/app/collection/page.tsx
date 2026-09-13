'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { cardCode, RARITIES, RARITY_LABELS, RECYCLE_VALUE } from '@miscellary/shared';
import type { CardSetSummary, OwnedCard, Rarity, SetPointsBalance } from '@miscellary/shared';
import CardGrid, { CardCell } from '@/components/CardGrid';
import PackStage from '@/components/PackStage';
import SearchField from '@/components/SearchField';
import Sheet, { Empty } from '@/components/Sheet';
import { OwnedCardInspector } from '@/components/CardInspector';
import CardPreview from '@/components/CardPreview';
import { useAuth } from '@/lib/auth';
import { useRequireAccount } from '@/lib/requireAccount';
import { listAllMyCards, listMyPoints, recycleCard } from '@/lib/packs';
import { listPublicSets } from '@/lib/sets';
import ui from '@/components/ui.module.css';
import wide from '@/components/pageWide.module.css';
import styles from './page.module.css';

// The API returns one row per owned copy, each annotated with how many copies
// the owner holds. Collapse them so a duplicate is one tile, not several.
function stack(owned: OwnedCard[]): OwnedCard[] {
  const seen = new Map<string, OwnedCard>();
  for (const copy of owned) {
    const current = seen.get(copy.card.id);
    if (!current || (current.held && !copy.held)) seen.set(copy.card.id, copy);
  }
  return [...seen.values()];
}

function Collection() {
  const { user, loading } = useAuth();
  useRequireAccount();
  const setSlug = useSearchParams().get('set') ?? undefined;
  const [cards, setCards] = useState<OwnedCard[] | null>(null);
  const [points, setPoints] = useState<SetPointsBalance[]>([]);
  const [packs, setPacks] = useState<Map<string, CardSetSummary>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [inspect, setInspect] = useState<OwnedCard | null>(null);
  const [recycling, setRecycling] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [gain, setGain] = useState<{ cardId: string; amount: number; key: number } | null>(null);

  const reload = useCallback(async () => {
    const [owned, pts] = await Promise.all([listAllMyCards(setSlug), listMyPoints()]);
    setCards(owned);
    setPoints(pts);
  }, [setSlug]);

  useEffect(() => {
    if (!user) return;
    reload().catch((e: Error) => setError(e.message));
  }, [user, reload]);

  // Owned cards carry their set's name but not its wrapper, so the artwork for
  // the column beside the grids comes from the public catalogue.
  useEffect(() => {
    if (!cards?.length) return;
    listPublicSets('popular')
      .then((page) => setPacks(new Map(page.results.map((s) => [s.slug, s]))))
      .catch(() => setPacks(new Map()));
  }, [cards]);

  async function onRecycle(owned: OwnedCard) {
    setError(null);
    setRecycling(owned.id);
    try {
      const result = await recycleCard(owned.id);
      setCards((current) =>
        current
          ? current
              .filter((copy) => copy.id !== owned.id)
              .map((copy) =>
                copy.card.id === owned.card.id ? { ...copy, copies: copy.copies - 1 } : copy,
              )
          : current,
      );
      setPoints((current) => [
        ...current.filter((balance) => balance.set_slug !== result.set_slug),
        { set_slug: result.set_slug, set_title: owned.set_title, points: result.points },
      ]);
      setInspect((current) =>
        current?.card.id === owned.card.id ? { ...current, copies: current.copies - 1 } : current,
      );
      const nextGain = { cardId: owned.card.id, amount: result.earned, key: Date.now() };
      setGain(nextGain);
      setTimeout(() => setGain((current) => (current?.key === nextGain.key ? null : current)), 800);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not recycle.');
    } finally {
      setRecycling(null);
    }
  }

  const group = (rows: OwnedCard[]) => {
    const grouped = new Map<string, OwnedCard[]>();
    for (const c of rows) {
      const list = grouped.get(c.set_slug) ?? [];
      list.push(c);
      grouped.set(c.set_slug, list);
    }
    return grouped;
  };

  const bySet = useMemo(() => group(cards ?? []), [cards]);

  const shown = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    if (!needle) return bySet;
    return group(
      (cards ?? []).filter(
        (c) =>
          c.card.title.toLowerCase().includes(needle) || c.set_title.toLowerCase().includes(needle),
      ),
    );
  }, [cards, bySet, filter]);

  const tally = useMemo(() => {
    const rows = cards ?? [];
    const distinct = new Map<string, OwnedCard>();
    for (const copy of rows) distinct.set(copy.card.id, copy);
    const byRarity = Object.fromEntries(RARITIES.map((r) => [r, 0])) as Record<Rarity, number>;
    for (const card of distinct.values()) byRarity[card.card.rarity] += 1;
    const spares = rows.length - distinct.size;
    const worth = [...distinct.values()].reduce(
      (n, copy) => n + Math.max(copy.copies - 1, 0) * RECYCLE_VALUE[copy.card.rarity],
      0,
    );
    return { copies: rows.length, distinct: distinct.size, byRarity, spares, worth };
  }, [cards]);

  const mostOf = Math.max(1, ...RARITIES.map((r) => tally.byRarity[r]));

  if (loading) return <p className={ui.muted}>Loading…</p>;
  if (!user) return <p className={ui.muted}>Taking you to create an account…</p>;

  const earned = points.filter((p) => p.points > 0).sort((a, b) => b.points - a.points);

  return (
    <div className={wide.page}>
      <span className={wide.lamp} aria-hidden="true" />

      <div className={`${wide.header} ${styles.header}`}>
        <div>
          <p className={ui.eyebrow}>Collection</p>
          <h1 className={ui.title}>{setSlug ? 'Your cards from this set' : 'My cards'}</h1>
          <p className={ui.subtitle}>
            {tally.distinct} {tally.distinct === 1 ? 'card' : 'cards'} across {bySet.size}{' '}
            {bySet.size === 1 ? 'set' : 'sets'}
          </p>
          {setSlug ? (
            <p className={styles.crumbs}>
              <Link href="/collection">All sets</Link> ·{' '}
              <Link href={`/sets/${setSlug}`}>Back to binder</Link>
            </p>
          ) : null}
        </div>
        {cards && cards.length > 1 ? (
          <SearchField
            className={styles.find}
            value={filter}
            onChange={setFilter}
            placeholder="Filter by card or set"
            label="Filter your collection by card or set"
          />
        ) : null}
      </div>
      {error ? <p className={ui.error}>{error}</p> : null}

      <div className={wide.layout}>
        <aside className={wide.jump} aria-label="Jump to a set">
          {[...shown.keys()].map((slug) => {
            const summary = packs.get(slug);
            return summary ? (
              <a key={slug} href={`#set-${slug}`} className={wide.jumpPack} title={summary.title}>
                <PackStage set={summary} />
              </a>
            ) : null;
          })}
        </aside>

        <main className={styles.grids}>
          {cards?.length && shown.size === 0 ? (
            <Sheet>
              <Empty
                icon="search"
                action={
                  <button type="button" className={ui.btnOutline} onClick={() => setFilter('')}>
                    Show every card
                  </button>
                }
              >
                Nothing in your collection matches &ldquo;{filter}&rdquo;.
              </Empty>
            </Sheet>
          ) : null}

          {cards?.length === 0 ? (
            <Sheet>
              <Empty
                icon="cards"
                action={
                  <Link className={ui.btnPrimary} href="/sets">
                    Browse sets
                  </Link>
                }
              >
                No cards yet. Every set gives you a free pack a day, so pick one and open it.
              </Empty>
            </Sheet>
          ) : null}

          {[...shown.entries()].map(([slug, list]) => {
            const balance = points.find((p) => p.set_slug === slug)?.points ?? 0;
            const stacked = stack(list);
            return (
              <div key={slug} id={`set-${slug}`}>
                <Sheet
                  className={styles.sheet}
                  title={
                    <Link href={`/sets/${slug}`} className={styles.groupTitle}>
                      {list[0]?.set_title}
                    </Link>
                  }
                  meta={`${stacked.length} ${stacked.length === 1 ? 'card' : 'cards'} · ${
                    list.length
                  } ${list.length === 1 ? 'copy' : 'copies'} · ${balance} set points`}
                >
                  <CardGrid>
                    {stacked.map((owned) => (
                      <CardCell
                        key={owned.card.id}
                        footer={
                          <span className={styles.recycleAnchor}>
                            {owned.copies > 1 ? (
                              <button
                                type="button"
                                className={styles.recycle}
                                onClick={() => void onRecycle(owned)}
                                disabled={owned.held || recycling === owned.id}
                                title={owned.held ? 'In a pending trade' : undefined}
                              >
                                ×{owned.copies} · Recycle one
                              </button>
                            ) : (
                              <span>Only copy</span>
                            )}
                            {gain?.cardId === owned.card.id ? (
                              <span key={gain.key} className={styles.pointGain}>
                                +{gain.amount}
                              </span>
                            ) : null}
                          </span>
                        }
                      >
                        <button
                          type="button"
                          className={styles.inspect}
                          onClick={() => setInspect(owned)}
                          aria-label={`Inspect ${owned.card.title}`}
                        >
                          <CardPreview
                            size="small"
                            title={owned.card.title}
                            rarity={owned.card.rarity}
                            code={cardCode(
                              owned.card.printed_set_code,
                              owned.card.position,
                              owned.card.set_total,
                            )}
                            printedText={owned.card.printed_text}
                            imageUrl={owned.card.image.url}
                            templateKey={owned.card.template_key}
                            templateConfig={owned.card.template_config}
                            mark={owned.set_mark}
                            render={owned.card.render}
                          />
                        </button>
                      </CardCell>
                    ))}
                  </CardGrid>
                </Sheet>
              </div>
            );
          })}
        </main>

        <aside className={wide.rail}>
          {cards?.length ? (
            <>
              <section className={`${ui.panel} ${wide.railPanel}`}>
                <h2 className={ui.panelTitle}>What you hold</h2>
                <ul className={wide.summary}>
                  <li>
                    <b>{tally.distinct}</b>
                    <span>different cards</span>
                  </li>
                  <li>
                    <b>{tally.copies}</b>
                    <span>copies in all</span>
                  </li>
                  <li>
                    <b>{tally.spares}</b>
                    <span>
                      spare {tally.spares === 1 ? 'copy' : 'copies'}
                      {tally.worth > 0 ? `, worth ${tally.worth} points` : ''}
                    </span>
                  </li>
                </ul>
              </section>

              <section className={`${ui.panel} ${wide.railPanel}`}>
                <h2 className={ui.panelTitle}>By rarity</h2>
                <ul className={styles.rarities}>
                  {RARITIES.map((rarity) => (
                    <li key={rarity} data-rarity={rarity}>
                      <span className={styles.rarityName}>{RARITY_LABELS[rarity]}</span>
                      <span className={styles.rarityBar}>
                        <span style={{ width: `${(tally.byRarity[rarity] / mostOf) * 100}%` }} />
                      </span>
                      <b>{tally.byRarity[rarity]}</b>
                    </li>
                  ))}
                </ul>
              </section>

              {earned.length ? (
                <section className={`${ui.panel} ${wide.railPanel}`}>
                  <h2 className={ui.panelTitle}>Set points</h2>
                  <ul className={wide.pointsList}>
                    {earned.map((balance) => (
                      <li key={balance.set_slug}>
                        <Link href={`#set-${balance.set_slug}`}>{balance.set_title}</Link>
                        <span>{balance.points}</span>
                      </li>
                    ))}
                  </ul>
                  <p className={wide.railNote}>
                    Points buy extra packs from the set they came from.
                  </p>
                </section>
              ) : null}
            </>
          ) : null}
        </aside>
      </div>

      {inspect ? <OwnedCardInspector owned={inspect} onClose={() => setInspect(null)} /> : null}
    </div>
  );
}

export default function CollectionPage() {
  return (
    <Suspense fallback={null}>
      <Collection />
    </Suspense>
  );
}

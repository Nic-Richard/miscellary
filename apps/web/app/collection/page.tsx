'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';
import type { OwnedCard, SetPointsBalance } from '@miscellary/shared';
import CardGrid, { CardCell } from '@/components/CardGrid';
import Sheet, { Empty } from '@/components/Sheet';
import { OwnedCardInspector } from '@/components/CardInspector';
import CardPreview from '@/components/CardPreview';
import { useAuth } from '@/lib/auth';
import { listMyCards, listMyPoints, recycleCard } from '@/lib/packs';
import ui from '@/components/ui.module.css';
import styles from './page.module.css';

// The API returns one row per owned copy, each annotated with how many copies
// the owner holds. Collapse them so a duplicate is one tile, not several.
function stack(owned: OwnedCard[]): OwnedCard[] {
  const seen = new Map<string, OwnedCard>();
  for (const copy of owned) if (!seen.has(copy.card.id)) seen.set(copy.card.id, copy);
  return [...seen.values()];
}

function Collection() {
  const { user, loading } = useAuth();
  const setSlug = useSearchParams().get('set') ?? undefined;
  const [cards, setCards] = useState<OwnedCard[] | null>(null);
  const [points, setPoints] = useState<SetPointsBalance[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [inspect, setInspect] = useState<OwnedCard | null>(null);

  const reload = useCallback(async () => {
    const [page, pts] = await Promise.all([listMyCards(setSlug), listMyPoints()]);
    setCards(page.results);
    setPoints(pts);
  }, [setSlug]);

  useEffect(() => {
    if (!user) return;
    reload().catch((e: Error) => setError(e.message));
  }, [user, reload]);

  async function onRecycle(owned: OwnedCard) {
    setError(null);
    try {
      await recycleCard(owned.id);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not recycle.');
    }
  }

  if (loading) return <p className={ui.muted}>Loading…</p>;
  if (!user)
    return (
      <p className={ui.muted}>
        <Link href="/login">Log in</Link> to see your collection.
      </p>
    );

  const bySet = new Map<string, OwnedCard[]>();
  for (const c of cards ?? []) {
    const list = bySet.get(c.set_slug) ?? [];
    list.push(c);
    bySet.set(c.set_slug, list);
  }

  return (
    <section>
      <p className={ui.eyebrow}>Collection</p>
      <h1 className={ui.title}>{setSlug ? 'Your cards from this set' : 'My cards'}</h1>
      <p className={ui.subtitle}>
        {cards?.length ?? 0} {cards?.length === 1 ? 'card' : 'cards'} across {bySet.size}{' '}
        {bySet.size === 1 ? 'set' : 'sets'}
      </p>
      {setSlug ? (
        <p className={styles.crumbs}>
          <Link href="/collection">All sets</Link> ·{' '}
          <Link href={`/sets/${setSlug}`}>Back to binder</Link>
        </p>
      ) : null}
      {error ? <p className={ui.error}>{error}</p> : null}
      {cards?.length === 0 ? (
        <Sheet className={styles.sheet}>
          <Empty
            icon="cards"
            action={
              <Link className={ui.btnPrimary} href="/sets">
                Browse binders
              </Link>
            }
          >
            No cards yet. Every set gives you a free pack a day, so pick one and open it.
          </Empty>
        </Sheet>
      ) : null}

      {[...bySet.entries()].map(([slug, list]) => {
        const balance = points.find((p) => p.set_slug === slug)?.points ?? 0;
        return (
          <Sheet
            key={slug}
            className={styles.sheet}
            title={
              <Link href={`/sets/${slug}`} className={styles.groupTitle}>
                {list[0]?.set_title}
              </Link>
            }
            meta={`${stack(list).length} ${stack(list).length === 1 ? 'card' : 'cards'} · ${
              list.length
            } ${list.length === 1 ? 'copy' : 'copies'} · ${balance} set points`}
          >
            <CardGrid>
              {stack(list).map((owned) => (
                <CardCell
                  key={owned.id}
                  footer={
                    owned.copies > 1 ? (
                      <button
                        type="button"
                        className={styles.recycle}
                        onClick={() => void onRecycle(owned)}
                        disabled={owned.held}
                        title={owned.held ? 'In a pending trade' : undefined}
                      >
                        ×{owned.copies} · Recycle one
                      </button>
                    ) : (
                      <span>Only copy</span>
                    )
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
                      number={owned.card.position + 1}
                      description={owned.card.description}
                      imageUrl={owned.card.image.url}
                      templateKey={owned.card.template_key}
                      templateConfig={owned.card.template_config}
                      mark={owned.set_mark}
                    />
                  </button>
                </CardCell>
              ))}
            </CardGrid>
          </Sheet>
        );
      })}

      {inspect ? <OwnedCardInspector owned={inspect} onClose={() => setInspect(null)} /> : null}
    </section>
  );
}

export default function CollectionPage() {
  return (
    <Suspense fallback={null}>
      <Collection />
    </Suspense>
  );
}

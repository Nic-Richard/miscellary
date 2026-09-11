'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { cardCode } from '@miscellary/shared';
import type { OwnedCard, SetPointsBalance } from '@miscellary/shared';
import CardGrid, { CardCell } from '@/components/CardGrid';
import Sheet, { Empty } from '@/components/Sheet';
import { OwnedCardInspector } from '@/components/CardInspector';
import CardPreview from '@/components/CardPreview';
import { useAuth } from '@/lib/auth';
import { loginHref } from '@/lib/returnTo';
import { listMyCards, listMyPoints, recycleCard } from '@/lib/packs';
import ui from '@/components/ui.module.css';
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
  const pathname = usePathname();
  const setSlug = useSearchParams().get('set') ?? undefined;
  const [cards, setCards] = useState<OwnedCard[] | null>(null);
  const [points, setPoints] = useState<SetPointsBalance[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [inspect, setInspect] = useState<OwnedCard | null>(null);
  const [recycling, setRecycling] = useState<string | null>(null);
  const [gain, setGain] = useState<{ cardId: string; amount: number; key: number } | null>(null);

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
      const nextGain = {
        cardId: owned.card.id,
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

  if (loading) return <p className={ui.muted}>Loading…</p>;
  if (!user)
    return (
      <p className={ui.muted}>
        <Link href={loginHref(pathname)}>Log in</Link> to see your collection.
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
                      description={owned.card.description}
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

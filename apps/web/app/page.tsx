'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { cardCode } from '@miscellary/shared';
import type { Card, CardSetDetail, CardSetSummary } from '@miscellary/shared';
import Binder from '@/components/binder/Binder';
import SetTile from '@/components/SetTile';
import CardPreview from '@/components/CardPreview';
import { SceneLight, slotLight } from '@/lib/lighting';
import { getPublicSet, listPublicSets } from '@/lib/sets';
import tileStyles from '@/components/SetTile.module.css';
import ui from '@/components/ui.module.css';
import styles from './page.module.css';

interface Pick {
  card: Card;
  set: CardSetSummary;
}

const PACK_ROW = 6;

const HERO = [
  { set: 'woodland-fungi', card: 'Fly Agaric' },
  { set: 'film-cameras', card: 'Canon AE-1' },
  { set: 'records-on-my-shelf', card: 'B-Side Blue' },
  { set: 'pocket-geology', card: 'River Quartz' },
  { set: 'garden-birds', card: 'European Robin' },
];

const SHOWCASE = 'film-cameras';

const DESK = [
  { left: 0, top: 24, rotate: -13 },
  { left: 18, top: 11, rotate: -6 },
  { left: 36, top: 17, rotate: 1 },
  { left: 54, top: 8, rotate: 7 },
  { left: 71, top: 20, rotate: 13 },
];

export default function HomePage() {
  const [sets, setSets] = useState<CardSetSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [picks, setPicks] = useState<(Pick | null)[]>([]);
  const [featured, setFeatured] = useState<CardSetDetail | null>(null);

  useEffect(() => {
    let live = true;
    listPublicSets('popular')
      .then(async (page) => {
        if (!live) return;
        setSets(page.results);
        setTotal(page.count);
        const named = (prefix: string) => page.results.find((s) => s.slug.startsWith(prefix));
        const wanted = [...new Set([...HERO.map((h) => h.set), SHOWCASE])];
        const details = new Map<string, CardSetDetail>();
        await Promise.all(
          wanted.map(async (prefix) => {
            const summary = named(prefix);
            if (!summary) return;
            const detail = await getPublicSet(summary.slug).catch(() => null);
            if (detail) details.set(prefix, detail);
          }),
        );
        if (!live) return;
        setFeatured(details.get(SHOWCASE) ?? null);
        setPicks(
          HERO.map(({ set, card }) => {
            const summary = named(set);
            const face = details.get(set)?.cards.find((c) => c.title === card);
            return summary && face ? { card: face, set: summary } : null;
          }),
        );
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);

  const packRow = sets.slice(0, PACK_ROW);

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.copy}>
          <h1 className={styles.title}>Turn collections into trading cards.</h1>
          <p className={ui.lead}>
            Make your own trading-card set, open free packs every day, and trade for the ones
            you&rsquo;re missing.
          </p>
          <div className={styles.actions}>
            <Link href="/sets" className={ui.btnPrimary}>
              Browse sets
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 12h15m-6-6 6 6-6 6" />
              </svg>
            </Link>
            <Link href="/register" className={ui.btnOutline}>
              Start a set
            </Link>
          </div>
          {total ? (
            <p className={styles.stats}>
              <b>{total}</b> published {total === 1 ? 'set' : 'sets'} to choose from so far
            </p>
          ) : null}
        </div>

        <div className={styles.desk}>
          <span className={styles.lamp} aria-hidden="true" />
          {DESK.map((at, i) => {
            const pick = picks[i];
            if (!pick) return null;
            return (
              <Link
                key={pick.card.id}
                href={`/sets/${pick.set.slug}`}
                className={styles.deskCard}
                style={
                  {
                    left: `${at.left}%`,
                    top: `${at.top}%`,
                    '--tilt': `${at.rotate}deg`,
                    ...slotLight(at.left + 15, at.top + 35),
                  } as React.CSSProperties
                }
                title={`${pick.card.title} · ${pick.set.title}`}
              >
                <SceneLight value={true}>
                  <CardPreview
                    size="small"
                    title={pick.card.title}
                    rarity={pick.card.rarity}
                    code={cardCode(
                      pick.card.printed_set_code,
                      pick.card.position,
                      pick.card.set_total,
                    )}
                    printedText={pick.card.printed_text}
                    imageUrl={pick.card.image.url}
                    templateKey={pick.card.template_key}
                    templateConfig={pick.card.template_config}
                    mark={pick.set.mark}
                    render={pick.card.render}
                  />
                </SceneLight>
              </Link>
            );
          })}
        </div>
      </section>

      {featured ? (
        <section className={styles.binderBand}>
          <div className={styles.sectionHead}>
            <div>
              <h2 className={styles.h2}>Inside a set</h2>
              <p className={styles.sectionNote}>
                Every set is an interactive binder you can turn a page at a time.
              </p>
            </div>
            <Link href={`/sets/${featured.slug}`} className={styles.more}>
              Open {featured.title} →
            </Link>
          </div>
          <Link
            href={`/sets/${featured.slug}`}
            className={styles.binderLink}
            aria-label={`Open the ${featured.title} binder`}
          >
            <Binder
              mark={featured.mark}
              colour={featured.binder_colour}
              slots={Array.from({ length: 8 }, (_, i) => {
                const card = featured.cards[i];
                if (!card) return null;
                return (
                  <CardPreview
                    size="small"
                    title={card.title}
                    rarity={card.rarity}
                    code={cardCode(card.printed_set_code, card.position, card.set_total)}
                    printedText={card.printed_text}
                    imageUrl={card.image.url}
                    templateKey={card.template_key}
                    templateConfig={card.template_config}
                    mark={featured.mark}
                    render={card.render}
                  />
                );
              })}
            />
          </Link>
        </section>
      ) : null}

      {sets.length ? (
        <section className={styles.shelfSection}>
          <div className={styles.sectionHead}>
            <div>
              <h2 className={styles.h2}>Open packs</h2>
              <p className={styles.sectionNote}>Tear one open and flip to reveal your cards.</p>
            </div>
            <Link href="/sets" className={styles.more}>
              Every set →
            </Link>
          </div>
          <ul className={`${tileStyles.grid} ${styles.packRow}`}>
            {packRow.map((s) => (
              <li key={s.id}>
                <SetTile set={s} meta={`${s.card_count} cards · @${s.creator.username}`} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className={`${ui.ticket} ${styles.make}`}>
        <div>
          <h2 className={styles.h2}>Start collecting and creating</h2>
          <p className={styles.makeText}>Sign up free to create sets and open packs.</p>
        </div>
        <div className={styles.makeActions}>
          <Link href="/register" className={ui.btnPrimary}>
            Create an account
          </Link>
          <Link href="/login" className={ui.btnOutline}>
            Log in
          </Link>
        </div>
      </section>
    </div>
  );
}

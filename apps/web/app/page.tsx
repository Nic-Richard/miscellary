'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { Card, CardSetSummary } from '@miscellary/shared';
import BinderCover from '@/components/BinderCover';
import CardPreview from '@/components/CardPreview';
import PackPouch from '@/components/PackPouch';
import { getPublicSet, listPublicSets } from '@/lib/sets';
import coverStyles from '@/components/BinderCover.module.css';
import ui from '@/components/ui.module.css';
import styles from './page.module.css';

interface Pick {
  card: Card;
  set: CardSetSummary;
}

export default function HomePage() {
  const [sets, setSets] = useState<CardSetSummary[]>([]);
  const [picks, setPicks] = useState<Pick[]>([]);

  useEffect(() => {
    let live = true;
    listPublicSets('popular')
      .then(async (page) => {
        if (!live) return;
        setSets(page.results);
        const chosen = page.results.slice(0, 4);
        const details = await Promise.all(
          chosen.map((s) => getPublicSet(s.slug).catch(() => null)),
        );
        if (!live) return;
        setPicks(
          details.flatMap((detail, i) => {
            const set = chosen[i];
            const best = detail?.cards.slice().sort((a, b) => rank(b) - rank(a))[0];
            return best && set ? [{ card: best, set }] : [];
          }),
        );
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);

  const hero = sets[0];
  const cardCount = sets.reduce((n, s) => n + s.card_count, 0);
  const creators = new Set(sets.map((s) => s.creator.username)).size;

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.copy}>
          <p className={ui.eyebrow}>Miscellary</p>
          <h1 className={styles.title}>
            Everything can be
            <br />a collection.
          </h1>
          <p className={ui.lead}>
            Fungi, manhole covers, tape decks, garden birds. Turn anything into a trading-card set,
            open a free pack every day, and trade with the people collecting the rest.
          </p>
          <div className={styles.actions}>
            <Link href="/sets" className={ui.btnPrimary}>
              Browse binders
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 12h15m-6-6 6 6-6 6" />
              </svg>
            </Link>
            <Link href="/register" className={ui.btnOutline}>
              Start a set
            </Link>
          </div>
          {sets.length ? (
            <p className={styles.stats}>
              <b>{sets.length}</b> sets · <b>{cardCount}</b> cards · <b>{creators}</b> creators
            </p>
          ) : null}
        </div>

        <div className={styles.art}>
          <div className={styles.glow} aria-hidden="true" />
          <div className={styles.fan}>
            {picks.map((pick, i) => (
              <Link
                key={pick.card.id}
                href={`/sets/${pick.set.slug}`}
                className={styles.fanCard}
                style={{ '--i': i } as React.CSSProperties}
                title={`${pick.card.title} · ${pick.set.title}`}
              >
                <CardPreview
                  size="small"
                  title={pick.card.title}
                  rarity={pick.card.rarity}
                  number={pick.card.position + 1}
                  description={pick.card.description}
                  imageUrl={pick.card.image.url}
                  templateKey={pick.card.template_key}
                  templateConfig={pick.card.template_config}
                  mark={pick.set.mark}
                />
              </Link>
            ))}
          </div>
          {hero ? (
            <div className={styles.pouch}>
              <PackPouch title={hero.title} identity={hero} />
            </div>
          ) : null}
        </div>
      </section>

      {sets.length ? (
        <section className={styles.shelfSection}>
          <div className={styles.sectionHead}>
            <h2 className={styles.h2}>What people are collecting</h2>
            <Link href="/sets" className={styles.more}>
              Every set →
            </Link>
          </div>
          <ul className={coverStyles.shelf}>
            {sets.slice(0, 5).map((s) => (
              <li key={s.id}>
                <BinderCover set={s} meta={`${s.card_count} cards · @${s.creator.username}`} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className={styles.beats}>
        <div className={styles.beat}>
          <span className={styles.beatArt}>
            {hero ? <PackPouch title={hero.title} identity={hero} /> : null}
          </span>
          <h3 className={styles.beatTitle}>A pack a day</h3>
          <p className={styles.beatText}>
            Every set gives you one free pack every day. Tear it open and see what you pulled.
          </p>
        </div>
        <div className={styles.beat}>
          <span className={`${styles.beatArt} ${styles.beatSleeves}`}>
            {picks.slice(0, 2).map((pick) => (
              <span key={pick.card.id} className={styles.beatCard}>
                <CardPreview
                  size="small"
                  title={pick.card.title}
                  rarity={pick.card.rarity}
                  description=""
                  imageUrl={pick.card.image.url}
                  templateKey={pick.card.template_key}
                  templateConfig={pick.card.template_config}
                  mark={pick.set.mark}
                />
              </span>
            ))}
          </span>
          <h3 className={styles.beatTitle}>Fills a binder</h3>
          <p className={styles.beatText}>
            Pulls go straight into the set&rsquo;s binder, in sleeves, in order, with the gaps
            showing.
          </p>
        </div>
        <div className={styles.beat}>
          <span className={`${styles.beatArt} ${styles.beatSwap}`}>
            {picks.slice(2, 4).map((pick, i) => (
              <span key={pick.card.id} className={styles.beatCard} data-side={i}>
                <CardPreview
                  size="small"
                  title={pick.card.title}
                  rarity={pick.card.rarity}
                  description=""
                  imageUrl={pick.card.image.url}
                  templateKey={pick.card.template_key}
                  templateConfig={pick.card.template_config}
                  mark={pick.set.mark}
                />
              </span>
            ))}
            <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.beatArrow}>
              <path d="M4 9h14l-4-4M20 15H6l4 4" />
            </svg>
          </span>
          <h3 className={styles.beatTitle}>Trade the doubles</h3>
          <p className={styles.beatText}>
            Offer your spares for the ones you are missing, and counter until it is a deal.
          </p>
        </div>
      </section>
    </div>
  );
}

const ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
function rank(card: Card): number {
  return ORDER.indexOf(card.rarity);
}

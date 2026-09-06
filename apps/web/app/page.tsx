'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { PACK_SIZE, RARITIES } from '@miscellary/shared';
import type { Card, CardSetDetail, CardSetSummary } from '@miscellary/shared';
import Binder from '@/components/binder/Binder';
import BinderCover from '@/components/BinderCover';
import CardPreview from '@/components/CardPreview';
import PackPouch from '@/components/PackPouch';
import { slotLight } from '@/lib/lighting';
import { getPublicSet, listPublicSets } from '@/lib/sets';
import coverStyles from '@/components/BinderCover.module.css';
import ui from '@/components/ui.module.css';
import styles from './page.module.css';

interface Pick {
  card: Card;
  set: CardSetSummary;
}

// Hero object positions are percentages of the stage.
const DESK = [
  { left: 0, top: 15, rotate: -11 },
  { left: 21, top: 3, rotate: -2 },
  { left: 42, top: 11, rotate: 8 },
];

export default function HomePage() {
  const [sets, setSets] = useState<CardSetSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [picks, setPicks] = useState<Pick[]>([]);
  const [featured, setFeatured] = useState<CardSetDetail | null>(null);

  useEffect(() => {
    let live = true;
    listPublicSets('popular')
      .then(async (page) => {
        if (!live) return;
        setSets(page.results);
        setTotal(page.count);
        const chosen = page.results.slice(0, 4);
        const whole = page.results.find((s) => s.card_count >= 8) ?? page.results[0];
        const details = await Promise.all(
          [...chosen, ...(whole && !chosen.includes(whole) ? [whole] : [])].map((s) =>
            getPublicSet(s.slug).catch(() => null),
          ),
        );
        if (!live) return;
        setFeatured(details.find((d) => d?.slug === whole?.slug) ?? null);
        setPicks(
          details.slice(0, chosen.length).flatMap((detail, i) => {
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
  const deck = picks.slice(0, 3);
  const steps = [
    {
      n: '001',
      title: 'Pick something',
      text: 'Fungi, manhole covers, tape decks, garden birds. If someone catalogued it, there is a set.',
    },
    {
      n: '002',
      title: 'Open a pack',
      text: `Every set gives you one free pack a day. ${PACK_SIZE} cards, torn open, one at a time.`,
    },
    {
      n: '003',
      title: 'Fill it in',
      text: 'Pulls drop into the binder in order. Trade your doubles for the gaps that are left.',
    },
  ];

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
            Turn anything you know too much about into a trading-card set. Publish it, open a free
            pack from every set every day, and trade with the people collecting the rest.
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
          {total ? (
            <p className={styles.stats}>
              <b>{total}</b> {total === 1 ? 'set' : 'sets'} published · one free pack from every one
              of them, every day
            </p>
          ) : null}
        </div>

        <div className={styles.desk}>
          <span className={styles.lamp} aria-hidden="true" />
          {deck.map((pick, i) => {
            const at = DESK[i]!;
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
            );
          })}
          {hero ? (
            <Link href={`/sets/${hero.slug}`} className={styles.deskPack} title={hero.title}>
              <PackPouch title={hero.title} identity={hero} />
            </Link>
          ) : null}
        </div>
      </section>

      {featured ? (
        <section className={styles.binderBand}>
          <div className={styles.sectionHead}>
            <div>
              <h2 className={styles.h2}>Every set is a binder</h2>
              <p className={styles.sectionNote}>
                Cards sit in sleeves in the order they were published, and the gaps stay visible
                until you pull them.
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
                    number={i + 1}
                    description={card.description}
                    imageUrl={card.image.url}
                    templateKey={card.template_key}
                    templateConfig={card.template_config}
                    mark={featured.mark}
                  />
                );
              })}
            />
          </Link>
        </section>
      ) : null}

      <section className={styles.steps}>
        {steps.map((step) => (
          <div key={step.n} className={styles.step}>
            <b className={styles.stepNo}>{step.n}</b>
            <h3 className={styles.stepTitle}>{step.title}</h3>
            <p className={styles.stepText}>{step.text}</p>
          </div>
        ))}
      </section>

      {sets.length ? (
        <section className={styles.shelfSection}>
          <div className={styles.sectionHead}>
            <div>
              <h2 className={styles.h2}>What people are collecting</h2>
              <p className={styles.sectionNote}>
                Published sets, newest pulls first. Anyone can open a pack from any of them.
              </p>
            </div>
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

      <section className={`${ui.ticket} ${styles.make}`}>
        <div>
          <h2 className={styles.h2}>Make one of your own</h2>
          <p className={styles.makeText}>
            Photograph what you have, write the notes, choose the stock and the ink, and set the
            rarities. Publish it and it becomes a binder anyone can collect.
          </p>
        </div>
        <div className={styles.makeActions}>
          <Link href="/register" className={ui.btnPrimary}>
            Start a set
          </Link>
          <Link href="/studio" className={ui.btnOutline}>
            Open the studio
          </Link>
        </div>
      </section>
    </div>
  );
}

function rank(card: Card): number {
  return RARITIES.indexOf(card.rarity);
}

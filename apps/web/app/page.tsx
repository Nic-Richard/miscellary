import Link from 'next/link';
import { HomeAuthBanner, StartSetLink } from './HomeAuthActions';
import { cardCode, personHandle } from '@miscellary/shared';
import type { Card, CardSetDetail, CardSetSummary } from '@miscellary/shared';
import Binder from '@/components/binder/Binder';
import SetTile from '@/components/SetTile';
import CardPreview from '@/components/CardPreview';
import { SceneLight } from '@/lib/lighting';
import { slotLight } from '@/lib/lightingStyle';
import { getPublicSet, listPublicSets } from '@/lib/sets';
import tileStyles from '@/components/SetTile.module.css';
import ui from '@/components/ui.module.css';
import wide from '@/components/pageWide.module.css';
import styles from './page.module.css';

export const revalidate = 300;

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

export default async function HomePage() {
  const page = await listPublicSets('popular').catch(() => null);
  const sets = page?.results ?? [];
  const total = page?.count ?? 0;
  const named = (prefix: string) => sets.find((set) => set.slug.startsWith(prefix));
  const wanted = [...new Set([...HERO.map((entry) => entry.set), SHOWCASE])];
  const loaded = new Map(
    await Promise.all(
      wanted.map(async (prefix) => {
        const summary = named(prefix);
        if (!summary) return [prefix, null] as const;
        const detail = await getPublicSet(summary.slug).catch(() => null);
        return [prefix, detail ? { summary, detail } : null] as const;
      }),
    ),
  );
  const picks: (Pick | null)[] = HERO.map(({ set, card }) => {
    const loadedSet = loaded.get(set);
    const face = loadedSet?.detail.cards.find((entry) => entry.title === card);
    return loadedSet && face ? { card: face, set: loadedSet.summary } : null;
  });
  const featured: CardSetDetail | null = loaded.get(SHOWCASE)?.detail ?? null;

  const packRow = sets.slice(0, PACK_ROW);

  return (
    <div className={`${wide.full} ${styles.page}`}>
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
            <StartSetLink />
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
                    forceFlat
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
                <SetTile set={s} meta={`${s.card_count} cards · ${personHandle(s.creator)}`} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <HomeAuthBanner />
    </div>
  );
}

'use client';

import { useEffect, useRef, useState } from 'react';
import type { PackOpening, Rarity } from '@miscellary/shared';
import { RARITIES } from '@miscellary/shared';
import CardBack from './CardBack';
import CardPreview from './CardPreview';
import PackTear from './PackTear';
import ui from './ui.module.css';
import styles from './PackReveal.module.css';

function rank(r: Rarity) {
  return RARITIES.indexOf(r);
}

export default function PackReveal({
  opening,
  onClose,
}: {
  opening: PackOpening;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<'sealed' | 'tearing' | 'open'>('sealed');
  const [revealed, setRevealed] = useState(0);
  const total = opening.cards.length;
  const done = revealed >= total;
  const best = opening.cards.reduce((a, b) => (rank(b.card.rarity) > rank(a.card.rarity) ? b : a));
  const legendaryPulled = best.card.rarity === 'legendary';
  const current = done ? best : opening.cards[revealed - 1];

  useEffect(() => {
    const previousFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialogRef.current?.focus();
    return () => previousFocus?.focus();
  }, []);

  useEffect(() => {
    if (phase !== 'tearing') return;
    const t = setTimeout(() => setPhase('open'), 620);
    return () => clearTimeout(t);
  }, [phase]);

  function next() {
    setRevealed((n) => Math.min(n + 1, total));
  }

  return (
    <div
      ref={dialogRef}
      className={styles.overlay}
      role="dialog"
      aria-label="Pack opening"
      aria-modal="true"
      tabIndex={-1}
      onKeyDown={(event) => {
        if (event.key === 'Escape') onClose();
      }}
    >
      <div className={styles.header}>
        <p className={styles.eyebrow}>
          {opening.kind === 'free' ? 'Daily pack' : 'Extra pack'} · {opening.card_set.title}
        </p>
        <h2 className={styles.headline}>
          {phase === 'sealed'
            ? 'Tear it open'
            : phase === 'tearing'
              ? ' '
              : !done
                ? revealed === 0
                  ? 'Tap the stack'
                  : current?.card.title
                : legendaryPulled
                  ? 'Legendary pull!'
                  : 'Pack complete'}
        </h2>
        <span className={styles.hint} aria-live="polite">
          {phase !== 'open'
            ? `${total} cards sealed inside`
            : done
              ? 'All cards revealed'
              : `${revealed} of ${total} revealed`}
        </span>
      </div>

      {phase !== 'open' ? (
        <div className={phase === 'tearing' ? styles.spent : undefined}>
          <PackTear
            title={opening.card_set.title}
            identity={opening.card_set}
            onTorn={() => setPhase('tearing')}
          />
        </div>
      ) : (
        <div className={styles.stage}>
          <div className={styles.spot} data-rarity={current?.card.rarity ?? 'common'} />
          {!done ? (
            <button
              type="button"
              className={styles.deck}
              onClick={next}
              aria-label="Reveal the next card"
            >
              {opening.cards.slice(revealed, revealed + 4).map((o, i) => (
                <div
                  key={o.id}
                  className={styles.deckCard}
                  style={{ '--i': i } as React.CSSProperties}
                >
                  <CardBack
                    mark={opening.card_set.mark}
                    packColour={opening.card_set.pack_colour}
                    title={opening.card_set.title}
                  />
                </div>
              ))}
              <span className={styles.deckCount}>{total - revealed} left</span>
            </button>
          ) : null}

          {current ? (
            <div
              key={current.id}
              className={`${styles.current} ${done ? styles.final : ''}`}
              data-rarity={current.card.rarity}
              onClick={!done ? next : undefined}
            >
              <div className={styles.burst} />
              <CardPreview
                title={current.card.title}
                rarity={current.card.rarity}
                number={current.card.position + 1}
                description={current.card.description}
                imageUrl={current.card.image.url}
                templateKey={current.card.template_key}
                templateConfig={current.card.template_config}
                mark={opening.card_set.mark}
              />
              <span className={current.copies > 1 ? styles.dupe : styles.new}>
                {current.copies > 1 ? `Duplicate ×${current.copies}` : 'New to your collection'}
              </span>
            </div>
          ) : null}
        </div>
      )}

      {phase === 'open' ? (
        <div className={styles.ledge}>
          {opening.cards.map((o, i) => (
            <div
              key={o.id}
              className={`${styles.ledgeCard} ${i < revealed ? styles.ledgeUp : ''} ${
                o.card.rarity === 'epic' || o.card.rarity === 'legendary' ? styles.ledgeRaised : ''
              }`}
              data-rarity={o.card.rarity}
            >
              {i < revealed ? (
                <CardPreview
                  size="small"
                  title={o.card.title}
                  rarity={o.card.rarity}
                  number={o.card.position + 1}
                  description=""
                  imageUrl={o.card.image.url}
                  templateKey={o.card.template_key}
                  templateConfig={o.card.template_config}
                  mark={opening.card_set.mark}
                />
              ) : (
                <CardBack
                  mark={opening.card_set.mark}
                  packColour={opening.card_set.pack_colour}
                  title={opening.card_set.title}
                />
              )}
            </div>
          ))}
        </div>
      ) : null}

      <div className={styles.actions}>
        {phase === 'open' && !done ? (
          <button
            type="button"
            className={`${ui.btnQuiet} ${styles.quiet}`}
            onClick={() => setRevealed(total)}
          >
            Reveal all
          </button>
        ) : null}
        <button type="button" className={ui.btnPrimary} onClick={onClose}>
          {done ? 'Done' : 'Skip'}
        </button>
      </div>
    </div>
  );
}

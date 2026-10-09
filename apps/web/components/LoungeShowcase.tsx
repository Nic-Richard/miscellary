import { cardCode } from '@miscellary/shared';
import type { LoungeCard, LoungeStyle } from '@miscellary/shared';
import type { CSSProperties } from 'react';
import CardPreview from './CardPreview';
import Binder from './binder/Binder';
import styles from './LoungeShowcase.module.css';

export default function LoungeShowcase({
  cards,
  style,
  onInspect,
}: {
  cards: (LoungeCard | null)[];
  style: LoungeStyle;
  onInspect: (card: LoungeCard) => void;
}) {
  const slots = cards.map((card, index) => (
    <div key={index}>
      {card ? (
        <button
          type="button"
          className={styles.cardButton}
          onClick={() => onInspect(card)}
          aria-label={`Inspect ${card.title}`}
        >
          <CardPreview
            title={card.title}
            rarity={card.rarity}
            imageUrl={card.image?.url ?? null}
            templateKey={card.template_key}
            templateConfig={card.template_config}
            code={cardCode(card.printed_set_code, card.position, card.set_total)}
            printedText={card.printed_text}
            render={card.render}
            previewThumbnail
            renderMode="flat"
          />
        </button>
      ) : (
        <p className={styles.missing}>Card no longer in this collection.</p>
      )}
    </div>
  ));
  return style === 'binder' ? (
    <div className={styles.binder}>
      <Binder slots={slots} animate={false} />
    </div>
  ) : (
    <div
      className={styles.cards}
      style={
        {
          '--columns': Math.min(cards.length, 3),
          '--narrow-columns': Math.min(cards.length, 2),
        } as CSSProperties
      }
    >
      {slots}
    </div>
  );
}

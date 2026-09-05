import type { ReactNode } from 'react';
import CardPreview from './CardPreview';
import { SHOWCASE_SLOTS } from '@miscellary/shared';
import type { OwnedCard, ShowcaseSlot } from '@miscellary/shared';
import styles from './ShowcaseCase.module.css';

interface ShowcaseCaseProps {
  slots: (ShowcaseSlot | null)[];
  title?: string;
  onPick?: (position: number) => void;
  onInspect?: (owned: OwnedCard) => void;
  mine?: boolean;
  footer?: ReactNode;
}

const DEFAULT_TITLE = 'The pride of the collection';

function Mounted({
  owned,
  onInspect,
}: {
  owned: OwnedCard;
  onInspect?: ((owned: OwnedCard) => void) | undefined;
}) {
  const card = (
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
  );
  if (!onInspect) return <span className={styles.sleeve}>{card}</span>;
  return (
    <button
      type="button"
      className={`${styles.sleeve} ${styles.inspect}`}
      onClick={() => onInspect(owned)}
      aria-label={`Inspect ${owned.card.title}`}
    >
      {card}
    </button>
  );
}

export default function ShowcaseCase({
  slots,
  title,
  onPick,
  onInspect,
  mine,
  footer,
}: ShowcaseCaseProps) {
  const filled = slots.filter(Boolean).length;
  return (
    <div className={styles.case}>
      <div className={styles.plate}>
        <span className={styles.caption}>{title?.trim() || DEFAULT_TITLE}</span>
        <span className={styles.count}>
          {filled} of {SHOWCASE_SLOTS}
        </span>
      </div>

      <div className={styles.glass}>
        <ul className={styles.mounts}>
          {slots.map((slot, i) => (
            <li key={slot ? slot.position : `empty-${i}`} className={styles.mount}>
              {slot ? (
                <>
                  <Mounted owned={slot.owned_card} onInspect={onInspect} />
                  <span className={styles.label}>{slot.owned_card.set_title}</span>
                </>
              ) : onPick ? (
                <button
                  type="button"
                  className={`${styles.sleeve} ${styles.empty}`}
                  onClick={() => onPick(i)}
                >
                  <span className={styles.emptyMark}>+</span>
                  <span className={styles.emptyWord}>Pin a card</span>
                </button>
              ) : (
                <span className={`${styles.sleeve} ${styles.empty}`}>
                  <span className={styles.emptyWord}>{mine ? 'Empty' : 'Empty mount'}</span>
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>

      {footer ? <div className={styles.footer}>{footer}</div> : null}
    </div>
  );
}

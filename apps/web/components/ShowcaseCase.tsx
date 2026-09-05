import type { ReactNode } from 'react';
import CardPreview from './CardPreview';
import { SHOWCASE_SLOTS } from '@miscellary/shared';
import type { ShowcaseSlot } from '@miscellary/shared';
import styles from './ShowcaseCase.module.css';

interface ShowcaseCaseProps {
  slots: (ShowcaseSlot | null)[];
  title?: string;
  onPick?: (position: number) => void;
  mine?: boolean;
  footer?: ReactNode;
}

const DEFAULT_TITLE = 'The pride of the collection';

export default function ShowcaseCase({ slots, title, onPick, mine, footer }: ShowcaseCaseProps) {
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
                  <span className={styles.sleeve}>
                    <CardPreview
                      size="small"
                      title={slot.owned_card.card.title}
                      rarity={slot.owned_card.card.rarity}
                      number={slot.owned_card.card.position + 1}
                      description={slot.owned_card.card.description}
                      imageUrl={slot.owned_card.card.image.url}
                      templateKey={slot.owned_card.card.template_key}
                      templateConfig={slot.owned_card.card.template_config}
                      mark={slot.owned_card.set_mark}
                    />
                  </span>
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

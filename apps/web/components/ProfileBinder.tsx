'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';
import { SHOWCASE_SLOTS } from '@miscellary/shared';
import type { OwnedCard, ShowcaseSlot } from '@miscellary/shared';
import Binder from './binder/Binder';
import CardPreview from './CardPreview';
import { binderClothStyle } from '@/lib/setIdentity';
import styles from './ProfileBinder.module.css';

interface ProfileBinderProps {
  slots: (ShowcaseSlot | null)[];
  title?: string;
  colour?: string | undefined;
  mine?: boolean;
  onPick?: ((position: number) => void) | undefined;
  onInspect?: ((owned: OwnedCard) => void) | undefined;
  footer?: ReactNode;
  /** Whether the binder starts open. */
  open?: boolean;
}

const DEFAULT_TITLE = 'The pride of the collection';

function Sleeved({
  owned,
  onInspect,
  onPick,
}: {
  owned: OwnedCard;
  onInspect?: ((owned: OwnedCard) => void) | undefined;
  onPick?: (() => void) | undefined;
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
  // Filled sleeves remain selectable while arranging the binder.
  if (onPick) {
    return (
      <button
        type="button"
        className={`${styles.inspect} ${styles.swap}`}
        onClick={onPick}
        title={`${owned.card.title} · ${owned.set_title}`}
        aria-label={`Change the sleeve holding ${owned.card.title}`}
      >
        {card}
      </button>
    );
  }
  if (!onInspect) return card;
  return (
    <button
      type="button"
      className={styles.inspect}
      onClick={() => onInspect(owned)}
      title={`${owned.card.title} · ${owned.set_title}`}
      aria-label={`Inspect ${owned.card.title} from ${owned.set_title}`}
    >
      {card}
    </button>
  );
}

export default function ProfileBinder({
  slots,
  title,
  colour,
  mine,
  onPick,
  onInspect,
  footer,
  open: startOpen = true,
}: ProfileBinderProps) {
  const [open, setOpen] = useState(startOpen);
  const filled = slots.filter(Boolean).length;
  const caption = title?.trim() || DEFAULT_TITLE;

  if (!open) {
    return (
      <div className={styles.shut}>
        <span
          className={styles.spine}
          style={binderClothStyle(colour || 'teal')}
          aria-hidden="true"
        />
        <div className={styles.shutText}>
          <h2 className={styles.caption}>{caption}</h2>
          <p className={styles.shutMeta}>
            {filled} of {SHOWCASE_SLOTS} sleeves filled
          </p>
        </div>
        <button type="button" className={styles.openBtn} onClick={() => setOpen(true)}>
          Open the binder
        </button>
      </div>
    );
  }

  return (
    <div className={styles.root}>
      <div className={styles.head}>
        <h2 className={styles.caption}>{caption}</h2>
        <span className={styles.count}>
          {filled} of {SHOWCASE_SLOTS}
          {startOpen ? null : (
            <button type="button" className={styles.shutBtn} onClick={() => setOpen(false)}>
              Close
            </button>
          )}
        </span>
      </div>
      <Binder
        colour={colour}
        emptyLabel={onPick ? 'Pin a card' : mine ? 'Empty' : 'Empty sleeve'}
        onPickEmpty={onPick}
        slots={slots.map((slot) =>
          slot ? (
            <Sleeved
              key={slot.position}
              owned={slot.owned_card}
              onInspect={onInspect}
              onPick={onPick ? () => onPick(slot.position) : undefined}
            />
          ) : null,
        )}
      />
      {footer ? <div className={styles.footer}>{footer}</div> : null}
    </div>
  );
}

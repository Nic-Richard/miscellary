'use client';

import type { BadgeColour, BadgeFinish, Creator } from '@miscellary/shared';
import { BADGE_COLOURS, BADGE_FINISHES } from '@miscellary/shared';
import Avatar from './Avatar';
import SupporterBadge from './SupporterBadge';
import ui from './ui.module.css';
import styles from './BadgePicker.module.css';

export default function BadgePicker({
  person,
  colour,
  finish,
  disabled,
  onChange,
}: {
  person: Creator;
  colour: BadgeColour;
  finish: BadgeFinish;
  disabled: boolean;
  onChange: (change: { badge_colour?: BadgeColour; badge_finish?: BadgeFinish }) => void;
}) {
  const style = `${colour}-${finish}`;
  return (
    <div className={styles.picker}>
      <div className={styles.preview} aria-hidden="true">
        <Avatar person={person} badge={style} size={40} />
        <SupporterBadge badge={style} />
      </div>
      <div className={styles.group}>
        <span className={ui.label}>Colour</span>
        <div className={styles.swatches} role="radiogroup" aria-label="Badge colour">
          {BADGE_COLOURS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="radio"
              aria-checked={colour === item.id}
              aria-label={item.label}
              title={item.label}
              className={styles.swatch}
              data-metal={item.id}
              data-finish={finish}
              disabled={disabled}
              onClick={() => onChange({ badge_colour: item.id })}
            />
          ))}
        </div>
      </div>
      <div className={styles.group}>
        <span className={ui.label}>Finish</span>
        <div className={ui.segments} role="radiogroup" aria-label="Badge finish">
          {BADGE_FINISHES.map((item) => (
            <button
              key={item.id}
              type="button"
              role="radio"
              aria-checked={finish === item.id}
              className={`${ui.segment} ${finish === item.id ? ui.segmentOn : ''}`}
              disabled={disabled}
              onClick={() => onChange({ badge_finish: item.id })}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

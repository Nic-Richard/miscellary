import type { CSSProperties } from 'react';
import type { BadgeStyle, Creator } from '@miscellary/shared';
import { splitBadge } from '@miscellary/shared';
import styles from './Avatar.module.css';

export default function Avatar({
  person,
  badge = null,
  size = 28,
}: {
  person: Creator | null;
  badge?: BadgeStyle | undefined;
  size?: number;
}) {
  const name = person?.display_name || person?.username || '';
  const metal = splitBadge(badge);
  return (
    <span
      className={`${styles.avatar} ${metal ? styles.supporter : ''}`}
      style={{ '--size': `${size}px` } as CSSProperties}
      data-metal={metal?.colour}
      data-finish={metal?.finish}
      {...(metal ? { role: 'img', 'aria-label': `${name}, supporter`, title: 'Supporter' } : {})}
      aria-hidden={metal ? undefined : true}
    >
      {person?.avatar_url ? (
        <img src={person.avatar_url} alt="" />
      ) : (
        <span>{name.charAt(0).toUpperCase() || '?'}</span>
      )}
    </span>
  );
}

import type { CSSProperties } from 'react';
import type { Creator } from '@miscellary/shared';
import styles from './Avatar.module.css';

export default function Avatar({
  person,
  supporter = false,
  size = 28,
}: {
  person: Creator | null;
  supporter?: boolean;
  size?: number;
}) {
  const name = person?.display_name || person?.username || '';
  return (
    <span
      className={`${styles.avatar} ${supporter ? styles.supporter : ''}`}
      style={{ '--size': `${size}px` } as CSSProperties}
      {...(supporter
        ? { role: 'img', 'aria-label': `${name}, supporter`, title: 'Supporter' }
        : {})}
      aria-hidden={supporter ? undefined : true}
    >
      {person?.avatar_url ? (
        <img src={person.avatar_url} alt="" />
      ) : (
        <span>{name.charAt(0).toUpperCase() || '?'}</span>
      )}
      {supporter && (
        <span className={styles.star}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z" />
          </svg>
        </span>
      )}
    </span>
  );
}

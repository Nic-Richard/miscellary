import Link from 'next/link';
import type { Tag } from '@miscellary/shared';
import styles from './TagList.module.css';

export default function TagList({
  tags,
  size = 'normal',
  label,
}: {
  tags: Tag[];
  size?: 'normal' | 'small';
  label?: string;
}) {
  if (!tags.length) return null;
  return (
    <ul className={`${styles.list} ${size === 'small' ? styles.small : ''}`} aria-label={label}>
      {tags.map((tag) => (
        <li key={tag.slug}>
          <Link className={styles.tag} href={`/search?q=${encodeURIComponent(tag.label)}`}>
            {tag.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}

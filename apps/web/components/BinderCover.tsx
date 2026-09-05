import Link from 'next/link';
import type { CardSetSummary } from '@miscellary/shared';
import styles from './BinderCover.module.css';

export default function BinderCover({
  set,
  href,
  meta,
}: {
  set: CardSetSummary;
  href?: string | undefined;
  meta?: string | undefined;
}) {
  return (
    <Link href={href ?? `/sets/${set.slug}`} className={styles.cover}>
      <span className={styles.window}>
        {set.cover ? <img src={set.cover.url} alt="" /> : <i>{set.title[0]}</i>}
      </span>
      <span className={styles.label}>
        <strong>{set.title}</strong>
        <small>
          {meta ?? `${set.card_count} cards · ♥ ${set.like_count} · @${set.creator.username}`}
        </small>
      </span>
    </Link>
  );
}

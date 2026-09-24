import Link from 'next/link';
import { personHandle } from '@miscellary/shared';
import type { CardSetSummary } from '@miscellary/shared';
import DemoBadge from './DemoBadge';
import PackStage from './PackStage';
import styles from './SetTile.module.css';

export default function SetTile({
  set,
  href,
  meta,
}: {
  set: CardSetSummary;
  href?: string | undefined;
  meta?: string | undefined;
}) {
  return (
    <Link href={href ?? `/sets/${set.slug}`} className={styles.tile}>
      <span className={styles.stage}>
        <PackStage set={set} />
        {set.creator.is_demo ? (
          <span className={styles.demo}>
            <DemoBadge compact />
          </span>
        ) : null}
      </span>
      <span className={styles.label}>
        <strong>{set.title}</strong>
        <small>
          {meta ?? `${set.card_count} cards · ♥ ${set.like_count} · ${personHandle(set.creator)}`}
        </small>
      </span>
    </Link>
  );
}

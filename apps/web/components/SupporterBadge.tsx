import type { BadgeStyle } from '@miscellary/shared';
import { splitBadge } from '@miscellary/shared';
import styles from './SupporterBadge.module.css';

export default function SupporterBadge({
  badge = 'gold-foil',
}: {
  badge?: BadgeStyle | undefined;
}) {
  const metal = splitBadge(badge) ?? splitBadge('gold-foil');
  return (
    <span className={styles.badge} data-metal={metal?.colour} data-finish={metal?.finish}>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z" />
      </svg>
      Supporter
    </span>
  );
}

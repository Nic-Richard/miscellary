import styles from './SupporterBadge.module.css';

export default function SupporterBadge() {
  return (
    <span className={styles.badge} role="img" aria-label="Monthly member" title="Monthly member">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z" />
      </svg>
    </span>
  );
}

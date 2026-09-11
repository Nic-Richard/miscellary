import styles from './DemoBadge.module.css';

export default function DemoBadge({ compact = false }: { compact?: boolean }) {
  return (
    <span className={`${styles.badge} ${compact ? styles.compact : ''}`} aria-label="Demo account">
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d="M8 3V1.5M5 1.5h6M3 6.2A2.2 2.2 0 0 1 5.2 4h5.6A2.2 2.2 0 0 1 13 6.2v4.6a2.2 2.2 0 0 1-2.2 2.2H5.2A2.2 2.2 0 0 1 3 10.8ZM5.5 8h.1M10.4 8h.1M5.5 10.5h5" />
      </svg>
      <span>{compact ? 'Demo' : 'Demo account'}</span>
    </span>
  );
}

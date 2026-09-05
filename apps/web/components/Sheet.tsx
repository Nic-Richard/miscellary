import type { ReactNode } from 'react';
import styles from './Sheet.module.css';

interface SheetProps {
  title?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string | undefined;
}

export default function Sheet({ title, meta, actions, children, className }: SheetProps) {
  return (
    <section className={`${styles.sheet} ${className ?? ''}`}>
      {title || meta || actions ? (
        <header className={styles.head}>
          <div className={styles.headRow}>
            {title ? <h2 className={styles.title}>{title}</h2> : <span />}
            {meta ? <span className={styles.meta}>{meta}</span> : null}
          </div>
          {actions ? <div className={styles.actions}>{actions}</div> : null}
        </header>
      ) : null}
      {children}
    </section>
  );
}

export function Empty({
  icon = 'cards',
  children,
  action,
}: {
  icon?: 'cards' | 'trade' | 'search' | 'binder';
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className={styles.empty}>
      <span className={styles.emptyMark} aria-hidden="true">
        {ICONS[icon]}
      </span>
      <p className={styles.emptyText}>{children}</p>
      {action ? <div className={styles.emptyAction}>{action}</div> : null}
    </div>
  );
}

const ICONS: Record<string, ReactNode> = {
  cards: (
    <svg viewBox="0 0 24 24">
      <rect x="3" y="5" width="12" height="16" rx="2" />
      <path d="M9 3h9a2 2 0 0 1 2 2v12" />
    </svg>
  ),
  trade: (
    <svg viewBox="0 0 24 24">
      <path d="M4 8h13l-3-3M20 16H7l3 3" />
    </svg>
  ),
  search: (
    <svg viewBox="0 0 24 24">
      <circle cx="11" cy="11" r="6" />
      <path d="m20 20-4.5-4.5" />
    </svg>
  ),
  binder: (
    <svg viewBox="0 0 24 24">
      <path d="M4 5h7v15H4zM13 5h7v15h-7z" />
      <path d="M11 5v15" />
    </svg>
  ),
};

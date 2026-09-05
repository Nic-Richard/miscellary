import type { ReactNode } from 'react';
import styles from './CardGrid.module.css';

export default function CardGrid({
  children,
  min,
  className,
}: {
  children: ReactNode;
  min?: number | undefined;
  className?: string | undefined;
}) {
  return (
    <div
      className={`${styles.grid} ${className ?? ''}`}
      style={min ? ({ '--card-min': `${min}px` } as React.CSSProperties) : undefined}
    >
      {children}
    </div>
  );
}

export function CardCell({ children, footer }: { children: ReactNode; footer?: ReactNode }) {
  return (
    <div className={styles.cell}>
      <div className={styles.card}>{children}</div>
      {footer ? <div className={styles.footer}>{footer}</div> : null}
    </div>
  );
}

export function EmptyCell({ label }: { label: string }) {
  return <div className={styles.empty}>{label}</div>;
}

import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react';
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

export function CardCell({
  children,
  footer,
  reorder,
}: {
  children: ReactNode;
  footer?: ReactNode;
  // Pointer events support the same reorder path for mouse and touch.
  reorder?: {
    id: string;
    dragging: boolean;
    over: boolean;
    onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  };
}) {
  return (
    <div
      className={`${styles.cell} ${reorder ? styles.draggable : ''} ${
        reorder?.dragging ? styles.dragging : ''
      } ${reorder?.over ? styles.over : ''}`}
      data-card-id={reorder?.id}
      onPointerDown={reorder?.onPointerDown}
    >
      <div className={styles.card}>{children}</div>
      {footer ? <div className={styles.footer}>{footer}</div> : null}
    </div>
  );
}

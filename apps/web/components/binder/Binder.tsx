import type { ReactNode } from 'react';
import SetMark from '../SetMark';
import { resolveMark } from '@/lib/setIdentity';
import styles from './Binder.module.css';

// Slot positions match binder.png; 5:7 cards overlap its printed placeholders.
const COLUMNS = [5.18, 26.39, 55.57, 76.78];
const ROWS = [2.92, 49.48];
const SLOT_WIDTH = 19.7;

function EmptySlot({ index, mark }: { index: number; mark?: string | undefined }) {
  return (
    <div className={styles.empty}>
      <b>{String(index).padStart(3, '0')}</b>
      <SetMark mark={resolveMark(mark)} className={styles.emptyMark} />
      <span>Not collected</span>
    </div>
  );
}

export default function Binder({
  slots,
  id,
  startIndex = 0,
  mark,
}: {
  slots: (ReactNode | null)[];
  id?: string | undefined;
  startIndex?: number;
  mark?: string | undefined;
}) {
  return (
    <div className={styles.binder} id={id}>
      <img className={styles.sheet} src="/materials/binder.png" alt="" draggable={false} />
      <img className={styles.cloth} src="/materials/binder-cloth.png" alt="" draggable={false} />
      {ROWS.flatMap((top, row) =>
        COLUMNS.map((left, column) => {
          const i = row * 4 + column;
          return (
            <div
              key={i}
              className={styles.slot}
              style={{ left: `${left}%`, top: `${top}%`, width: `${SLOT_WIDTH}%` }}
            >
              {slots[i] ?? <EmptySlot index={startIndex + i + 1} mark={mark} />}
            </div>
          );
        }),
      )}
    </div>
  );
}

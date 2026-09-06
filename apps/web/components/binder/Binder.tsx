'use client';

import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import SetMark from '../SetMark';
import { binderStyle, resolveMark } from '@/lib/setIdentity';
import { slotLight } from '@/lib/lighting';
import styles from './Binder.module.css';

const COLUMNS = [5.18, 26.39, 55.57, 76.78];
const ROWS = [2.92, 49.48];
const SLOT_WIDTH = 19.7;
const SLOT_HEIGHT = (SLOT_WIDTH * (1028 / 625) * 7) / 5;

const SLOTS = ROWS.flatMap((top, row) =>
  COLUMNS.map((left, column) => ({
    index: row * 4 + column,
    left,
    top,
    right: column >= 2,
  })),
);

const TURN_MS = 380;

interface Leaf {
  dir: 'next' | 'prev';
  slots: (ReactNode | null)[];
}

function EmptySlot({
  index,
  mark,
  label,
  onPick,
}: {
  index: number;
  mark?: string | undefined;
  label: string;
  onPick?: (() => void) | undefined;
}) {
  const inside = (
    <>
      <b>{String(index).padStart(3, '0')}</b>
      <SetMark mark={resolveMark(mark)} className={styles.emptyMark} />
      <span>{label}</span>
    </>
  );
  if (!onPick) return <div className={styles.empty}>{inside}</div>;
  return (
    <button type="button" className={`${styles.empty} ${styles.pick}`} onClick={onPick}>
      {inside}
    </button>
  );
}

export default function Binder({
  slots,
  id,
  page = 0,
  startIndex = 0,
  mark,
  colour,
  emptyLabel = 'Not collected',
  onPickEmpty,
}: {
  slots: (ReactNode | null)[];
  id?: string | undefined;
  /** Current binder spread. */
  page?: number;
  startIndex?: number;
  mark?: string | undefined;
  colour?: string | undefined;
  emptyLabel?: string;
  onPickEmpty?: ((index: number) => void) | undefined;
}) {
  const [leaf, setLeaf] = useState<Leaf | null>(null);
  const [still, setStill] = useState(false);
  // Capture the outgoing spread before props replace it.
  const shown = useRef({ page, slots });
  const leaving = useRef<Leaf | null>(null);
  if (shown.current.page !== page) {
    leaving.current = {
      dir: page > shown.current.page ? 'next' : 'prev',
      slots: shown.current.slots,
    };
    shown.current = { page, slots };
  }

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setStill(query.matches);
    sync();
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    const going = leaving.current;
    leaving.current = null;
    if (!going || still) return;
    setLeaf(going);
    const timer = setTimeout(() => setLeaf(null), TURN_MS + 30);
    return () => clearTimeout(timer);
  }, [page, still]);

  function place(slot: (typeof SLOTS)[number], content: ReactNode) {
    return (
      <div
        key={slot.index}
        className={styles.slot}
        style={{
          left: `${slot.left}%`,
          top: `${slot.top}%`,
          width: `${SLOT_WIDTH}%`,
          ...slotLight(slot.left + SLOT_WIDTH / 2, slot.top + SLOT_HEIGHT / 2),
        }}
      >
        {content}
      </div>
    );
  }

  return (
    <div className={styles.binder} id={id} style={binderStyle(colour)}>
      <img className={styles.sheet} src="/materials/binder.png" alt="" draggable={false} />
      <img className={styles.cloth} src="/materials/binder-cloth.png" alt="" draggable={false} />
      <span className={styles.lamp} aria-hidden="true" />
      {SLOTS.map((slot) =>
        place(
          slot,
          slots[slot.index] ?? (
            <EmptySlot
              index={startIndex + slot.index + 1}
              mark={mark}
              label={emptyLabel}
              onPick={onPickEmpty ? () => onPickEmpty(slot.index) : undefined}
            />
          ),
        ),
      )}

      {/* Animate the outgoing leaf over the already-updated spread. */}
      {leaf ? (
        <div className={styles.turnStage} aria-hidden="true">
          <div
            className={`${styles.leaf} ${leaf.dir === 'next' ? styles.leafNext : styles.leafPrev}`}
          >
            <div className={styles.face}>
              <span className={styles.paper} />
              {SLOTS.filter((slot) => slot.right === (leaf.dir === 'next')).map((slot) =>
                place(slot, leaf.slots[slot.index] ?? null),
              )}
              <span className={styles.shade} />
            </div>
            <div className={styles.back}>
              <span className={styles.paper} />
              <span className={styles.shade} />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react';
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

const TURN_MS = 460;

export interface BinderPage {
  slots: (ReactNode | null)[];
  startIndex: number;
}

interface Leaf {
  dir: 'next' | 'prev';
  fromPage: number;
  toPage: number;
}

function prepareImage(image: HTMLImageElement, cache: WeakMap<HTMLImageElement, string>) {
  const source = image.src;
  if (cache.get(image) === source) return;
  cache.set(image, source);
  const decode = () => void image.decode?.().catch(() => undefined);
  if (image.complete) decode();
  else image.addEventListener('load', decode, { once: true });
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
    </>
  );
  if (!onPick) return <div className={styles.empty}>{inside}</div>;
  return (
    <button
      type="button"
      className={`${styles.empty} ${styles.pick}`}
      aria-label={`${label}, sleeve ${index}`}
      onClick={onPick}
    >
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
  emptyLabel = 'Empty',
  onPickEmpty,
  onNavigate,
  pages,
  canPrevious = false,
  canNext = false,
}: {
  slots: (ReactNode | null)[];
  id?: string | undefined;

  page?: number;
  startIndex?: number;
  mark?: string | undefined;
  colour?: string | undefined;
  emptyLabel?: string;
  onPickEmpty?: ((index: number) => void) | undefined;
  onNavigate?: ((direction: -1 | 1) => void) | undefined;
  pages?: BinderPage[] | undefined;
  canPrevious?: boolean;
  canNext?: boolean;
}) {
  const motion = useRef<HTMLDivElement>(null);
  const gesture = useRef<{
    id: number;
    x: number;
    y: number;
    lastX: number;
    lastAt: number;
    velocity: number;
    active: boolean;
  } | null>(null);
  const suppressClick = useRef(false);
  const nextStage = useRef<HTMLDivElement>(null);
  const previousStage = useRef<HTMLDivElement>(null);
  const preparedImages = useRef(new WeakMap<HTMLImageElement, string>());
  const [shownPage, setShownPage] = useState(page);
  const [leaf, setLeaf] = useState<Leaf | null>(null);
  const [still, setStill] = useState(false);
  const shown = pages?.[shownPage] ?? { slots, startIndex };

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setStill(query.matches);
    sync();
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    for (const stage of [previousStage.current, nextStage.current]) {
      if (!stage) continue;
      for (const image of stage.querySelectorAll<HTMLImageElement>('img')) {
        prepareImage(image, preparedImages.current);
      }
    }
  }, [pages, shownPage]);

  useLayoutEffect(() => {
    if (page === shownPage) return;
    if (still || !pages) {
      setShownPage(page);
      setLeaf(null);
      return;
    }
    const dir = page > shownPage ? 'next' : 'prev';
    setLeaf({
      dir,
      fromPage: shownPage,
      toPage: page,
    });
  }, [page, pages, shownPage, still]);

  useEffect(() => {
    if (!leaf) return;
    let firstFrame = 0;
    let secondFrame = 0;
    const timer = setTimeout(() => {
      setShownPage(leaf.toPage);
      firstFrame = requestAnimationFrame(() => {
        secondFrame = requestAnimationFrame(() => {
          setLeaf((current) => (current === leaf ? null : current));
        });
      });
    }, TURN_MS + 30);
    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(firstFrame);
      cancelAnimationFrame(secondFrame);
    };
  }, [leaf]);

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

  function contentFor(
    source: (ReactNode | null)[],
    sourceStart: number,
    slot: (typeof SLOTS)[number],
    interactive: boolean,
  ) {
    return (
      source[slot.index] ?? (
        <EmptySlot
          index={sourceStart + slot.index + 1}
          mark={mark}
          label={emptyLabel}
          onPick={interactive && onPickEmpty ? () => onPickEmpty(slot.index) : undefined}
        />
      )
    );
  }

  function preparedPage(dir: 'next' | 'prev', targetPage: number, ref: typeof nextStage) {
    const destination = pages?.[targetPage];
    if (!destination) return null;
    const active = leaf?.dir === dir && leaf.toPage === targetPage;
    const outgoing = active ? (pages?.[leaf.fromPage] ?? shown) : shown;
    return (
      <div
        ref={ref}
        className={`${styles.prepared} ${active ? styles.preparedActive : ''}`}
        aria-hidden="true"
      >
        <div className={styles.revealed}>
          {SLOTS.map((slot) => {
            const source = slot.right === (dir === 'next') ? destination : outgoing;
            return place(slot, contentFor(source.slots, source.startIndex, slot, false));
          })}
        </div>
        <div className={`${styles.turnStage} ${active ? styles.turning : ''}`}>
          <div className={`${styles.leaf} ${dir === 'next' ? styles.leafNext : styles.leafPrev}`}>
            <div className={styles.face}>
              <img className={styles.leafSheet} src="/materials/binder.png" alt="" />
              <img className={styles.leafCloth} src="/materials/binder-cloth.png" alt="" />
              <span className={styles.leafLamp} />
              {SLOTS.filter((slot) => slot.right === (dir === 'next')).map((slot) =>
                place(slot, contentFor(outgoing.slots, outgoing.startIndex, slot, false)),
              )}
              <span className={styles.shade} />
            </div>
            <div className={styles.back}>
              <img className={styles.leafSheet} src="/materials/binder.png" alt="" />
              <img className={styles.leafCloth} src="/materials/binder-cloth.png" alt="" />
              <span className={styles.leafLamp} />
              {SLOTS.filter((slot) => slot.right === (dir === 'prev')).map((slot) =>
                place(slot, contentFor(destination.slots, destination.startIndex, slot, false)),
              )}
              <span className={styles.shade} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  function shift(x: number, settling: boolean) {
    const el = motion.current;
    if (!el) return;
    const progress = Math.min(1, Math.abs(x) / (el.clientWidth || 1));
    el.style.setProperty('--page-shadow', `${progress * 0.32}`);
    el.dataset.settling = settling ? 'true' : 'false';
  }

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (!onNavigate || e.button !== 0 || e.pointerType === 'mouse') return;
    gesture.current = {
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      lastX: e.clientX,
      lastAt: performance.now(),
      velocity: 0,
      active: false,
    };
    suppressClick.current = false;
  }

  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const drag = gesture.current;
    if (!drag || drag.id !== e.pointerId) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    if (!drag.active) {
      if (Math.abs(dy) > 6 && Math.abs(dy) > Math.abs(dx)) {
        gesture.current = null;
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId);
        }
        return;
      }
      if (Math.abs(dx) < 6 || Math.abs(dx) < Math.abs(dy)) return;
      drag.active = true;
      suppressClick.current = true;
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    e.preventDefault();
    const now = performance.now();
    drag.velocity = (e.clientX - drag.lastX) / Math.max(1, now - drag.lastAt);
    drag.lastX = e.clientX;
    drag.lastAt = now;
    const blocked = (dx > 0 && !canPrevious) || (dx < 0 && !canNext);
    shift(blocked ? dx * 0.18 : dx, false);
  }

  function onPointerUp(e: ReactPointerEvent<HTMLDivElement>) {
    const drag = gesture.current;
    if (!drag || drag.id !== e.pointerId) return;
    gesture.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    if (!drag.active) return;
    const dx = e.clientX - drag.x;
    const threshold = e.currentTarget.clientWidth * 0.12;
    const direction = dx < 0 ? 1 : -1;
    const allowed = direction > 0 ? canNext : canPrevious;
    const committed = Math.abs(dx) > threshold || Math.abs(drag.velocity) > 0.3;
    if (allowed && committed) onNavigate?.(direction);
    shift(0, true);
  }

  return (
    <div
      className={`${styles.binder} ${onNavigate ? styles.swipeable : ''}`}
      id={id}
      style={binderStyle(colour)}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onClickCapture={(event) => {
        if (!suppressClick.current) return;
        event.preventDefault();
        event.stopPropagation();
        suppressClick.current = false;
      }}
    >
      <div className={styles.motion} ref={motion}>
        <img className={styles.sheet} src="/materials/binder.png" alt="" draggable={false} />
        <img className={styles.cloth} src="/materials/binder-cloth.png" alt="" draggable={false} />
        <span className={styles.lamp} aria-hidden="true" />
        <div className={`${styles.resting} ${leaf ? styles.restingHidden : ''}`}>
          {SLOTS.map((slot) => place(slot, contentFor(shown.slots, shown.startIndex, slot, !leaf)))}
        </div>
        {preparedPage('prev', leaf?.dir === 'prev' ? leaf.toPage : shownPage - 1, previousStage)}
        {preparedPage('next', leaf?.dir === 'next' ? leaf.toPage : shownPage + 1, nextStage)}
        <span className={styles.dragShade} aria-hidden="true" />
      </div>
    </div>
  );
}

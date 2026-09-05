'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import PackPouch from './PackPouch';
import type { SetIdentity } from '@/lib/setIdentity';
import styles from './PackTear.module.css';

// Pointer events unify mouse, pen and touch; click and keyboard remain fallbacks.
const TEAR_Y = 13.2;
const STEPS = 120;

function hash(i: number): number {
  const n = Math.sin(i * 12.9898) * 43758.5453;
  return n - Math.floor(n) - 0.5;
}

// Tear coordinates are percentages of the pack box.
const TEAR: { x: number; y: number }[] = Array.from({ length: STEPS + 1 }, (_, i) => {
  const fibre = hash(i) * 1.15;
  const wander = Math.sin(i * 0.9) * 0.45 + Math.sin(i * 0.31) * 0.75;
  const tooth = i % 9 === 0 ? Math.sign(hash(i + 7)) * 0.8 : 0;
  return { x: (i / STEPS) * 100, y: TEAR_Y + fibre + wander + tooth };
});

const pct = (p: { x: number; y: number }) => `${p.x.toFixed(2)}% ${p.y.toFixed(2)}%`;

const points = (from: number, to: number) =>
  TEAR.slice(from, to + 1)
    .map((p) => `${p.x},${p.y}`)
    .join(' ');

function frontAt(progress: number): number {
  return Math.max(0, Math.min(STEPS, Math.round(progress * STEPS)));
}

function clips(progress: number) {
  const front = frontAt(progress);
  const seam = TEAR.slice(0, front + 1);
  const cut = seam[seam.length - 1]!;
  const opened = seam.map(pct).join(', ');
  return {
    body: `polygon(${opened}, ${cut.x.toFixed(2)}% 0%, 100% 0%, 100% 100%, 0% 100%)`,
    strip: `polygon(0% 0%, ${cut.x.toFixed(2)}% 0%, ${opened.split(', ').reverse().join(', ')})`,
    cut,
    seam,
  };
}

export default function PackTear({
  title,
  identity,
  onTorn,
}: {
  title: string;
  identity: SetIdentity;
  onTorn: () => void;
}) {
  const [progress, setProgress] = useState(0);
  // Held in a ref as well as state: a pointermove can arrive in the same tick as
  // the pointerdown that started the drag, before any re-render, and reading
  // state there would drop it.
  const [dragging, setDragging] = useState(false);
  const holding = useRef(false);
  const stage = useRef<HTMLDivElement>(null);
  const origin = useRef(0);
  const moved = useRef(false);
  const frame = useRef(0);
  const finished = useRef(false);

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  const glideTo = useCallback(
    (target: number, ms: number, then?: () => void) => {
      cancelAnimationFrame(frame.current);
      const from = progress;
      const start = performance.now();
      const step = (now: number) => {
        const t = Math.min(1, (now - start) / ms);
        const eased = 1 - Math.pow(1 - t, 3);
        setProgress(from + (target - from) * eased);
        if (t < 1) frame.current = requestAnimationFrame(step);
        else then?.();
      };
      frame.current = requestAnimationFrame(step);
    },
    [progress],
  );

  const finish = useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    glideTo(1, 220, onTorn);
  }, [glideTo, onTorn]);

  function down(e: ReactPointerEvent<HTMLDivElement>) {
    if (finished.current) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    cancelAnimationFrame(frame.current);
    origin.current = e.clientX;
    moved.current = false;
    holding.current = true;
    setDragging(true);
  }

  function move(e: ReactPointerEvent<HTMLDivElement>) {
    if (!holding.current || finished.current) return;
    const width = stage.current?.getBoundingClientRect().width ?? 300;
    // Scale travel to finish within the pack bounds.
    const raw = Math.max(0, Math.min(1, (e.clientX - origin.current) / (width * 0.8)));
    if (raw > 0.03) moved.current = true;
    // Ease the start of the drag so the foil resists before giving way.
    setProgress(Math.pow(raw, 1.35));
  }

  function up() {
    if (!holding.current || finished.current) return;
    holding.current = false;
    setDragging(false);
    if (!moved.current) finish();
    // Past one-third, finish the tear instead of snapping it closed.
    else if (progress > 0.32) finish();
    else glideTo(0, 320);
  }

  const { body, strip, cut } = clips(progress);
  const lift = progress * 22;

  return (
    <div
      ref={stage}
      className={`${styles.stage} ${dragging ? styles.dragging : ''}`}
      role="button"
      tabIndex={0}
      aria-label="Tear the pack open"
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          finish();
        }
      }}
    >
      <span className={styles.glow} aria-hidden="true" />

      <span className={styles.body} style={{ clipPath: body }}>
        <PackPouch title={title} identity={identity} />
      </span>

      {progress > 0.005 ? (
        <svg
          className={styles.seam}
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <polyline className={styles.settled} points={points(0, frontAt(progress))} />
          <polyline
            className={styles.fresh}
            points={points(Math.max(0, frontAt(progress) - 9), frontAt(progress))}
          />
        </svg>
      ) : null}

      <span
        className={styles.strip}
        style={{
          clipPath: strip,
          transformOrigin: `${cut.x}% ${cut.y}%`,
          transform: `rotate(${-lift}deg) translateY(${-progress * 7}px)`,
        }}
      >
        <PackPouch title={title} identity={identity} />
      </span>

      <span className={styles.notch} aria-hidden="true" data-open={progress > 0.02}>
        <svg viewBox="0 0 32 16">
          <path d="M1 3l5 5l-5 5" />
          <path d="M9 8h14" strokeDasharray="3 3" />
          <path d="M22 4l5 4l-5 4" />
        </svg>
      </span>

      <span className={styles.grip} aria-hidden="true" data-open={progress > 0.04}>
        Pull across to tear
      </span>
    </div>
  );
}

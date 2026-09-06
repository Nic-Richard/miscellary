'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import PackPouch from './PackPouch';
import type { SetIdentity } from '@/lib/setIdentity';
import styles from './PackTear.module.css';

const TEAR_Y = 11.4;
// Slight overlap prevents a clip-path seam between the pack halves.
const CLOSE_JOIN = 3;
const STEPS = 120;
// Taper lift to zero at the tear front so the strip stays attached there.
const PULL = 2.4;
const PACK_ASPECT = 908 / 545;

function hash(i: number): number {
  const n = Math.sin(i * 12.9898) * 43758.5453;
  return n - Math.floor(n) - 0.5;
}

const TEAR: { x: number; y: number }[] = Array.from({ length: STEPS + 1 }, (_, i) => {
  // Slow waves define the tear; small deterministic noise roughens the edge.
  const wander =
    Math.sin(i * 0.16) * 0.6 + Math.sin(i * 0.37 + 1.3) * 0.24 + Math.sin(i * 0.068) * 0.4;
  const fibre = hash(i) * 0.2;
  return { x: (i / STEPS) * 100, y: TEAR_Y + wander + fibre };
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
    strip:
      `polygon(-5% 0%, ${cut.x.toFixed(2)}% 0%, ` +
      `${opened.split(', ').reverse().join(', ')}, -5% ${TEAR[0]!.y.toFixed(2)}%)`,
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
  // Ref avoids dropping pointermove events before state rerenders.
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
    const raw = Math.max(0, Math.min(1, (e.clientX - origin.current) / (width * 0.8)));
    if (raw > 0.03) moved.current = true;
    setProgress(Math.pow(raw, 1.35));
  }

  function up() {
    if (!holding.current || finished.current) return;
    holding.current = false;
    setDragging(false);
    if (!moved.current) finish();
    else if (progress > 0.32) finish();
    else glideTo(0, 320);
  }

  const { body, strip, cut } = clips(progress);
  // Keep the strip anchored at the moving tear front.
  const pull = PULL * Math.min(1, progress / 0.4);
  const shear = (Math.atan((pull * PACK_ASPECT) / Math.max(cut.x, 4)) * 180) / Math.PI;
  // Shade the strip as one surface to avoid visible panel bands.
  const shade =
    `linear-gradient(90deg, rgba(6,18,16,0.52) 0%, rgba(6,18,16,0.16) ` +
    `${(cut.x * 0.7).toFixed(1)}%, rgba(6,18,16,0) ${Math.max(cut.x, 1).toFixed(1)}%)`;

  return (
    <div
      ref={stage}
      style={{ '--tear-y': `${TEAR_Y}%` } as React.CSSProperties}
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
        <span className={styles.inside} style={{ clipPath: strip }} aria-hidden="true" />
      ) : null}

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
          transformOrigin: `${cut.x}% ${TEAR_Y}%`,
          transform: `translateX(${CLOSE_JOIN}px) skewY(${shear.toFixed(3)}deg)`,
        }}
      >
        <PackPouch title={title} identity={identity} />
        <span className={styles.foldShade} style={{ background: shade }} />
      </span>

      <span className={styles.tab} aria-hidden="true" data-open={progress > 0.02}>
        <svg className={styles.tabIcon} viewBox="0 0 46 16">
          <path d="M5 3.5v9M9.5 5v6" />
          <path d="M16 8h17m-6-5 6 5-6 5" />
        </svg>
      </span>

      <span className={styles.grip} aria-hidden="true" data-open={progress > 0.04}>
        Pull across to tear
      </span>
    </div>
  );
}

'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react';
import { RARITY_LABELS } from '@miscellary/shared';
import type { Card, Creator, OwnedCard } from '@miscellary/shared';
import CardBack from './CardBack';
import CardPreview from './CardPreview';
import Description from './Description';
import styles from './CardInspector.module.css';

export interface CardInspectorProps {
  card: Card;
  setTitle: string;
  setSlug: string;
  mark?: string | undefined;
  packColour?: string | undefined;
  creator?: Creator | undefined;
  copies?: number | undefined;
  actions?: ReactNode;
  onClose: () => void;
}

const SPEED = 0.42;
const MAX_TILT = 52;
const FRICTION = 0.9;
// Scale release velocity before inertia.
const THROW = 0.3;
const MAX_THROW = 9;
const TURN_MS = 420;

// Match the preview's corner radius so the extrusion follows the card shape.
const CORNER: Record<string, number> = { round: 0.03, soft: 0.016, sharp: 0.004 };

// Stacked silhouettes keep the extruded edge aligned with rounded corners.
const CORE_LAYERS = [0, 1, 2, 3, 4, 5, 6];

function shortest(from: number, to: number): number {
  return from + ((((to - from) % 360) + 540) % 360) - 180;
}

export default function CardInspector({
  card,
  setTitle,
  setSlug,
  mark,
  packColour,
  creator,
  copies,
  actions,
  onClose,
}: CardInspectorProps) {
  const slab = useRef<HTMLDivElement>(null);
  const frame = useRef(0);
  const drag = useRef<{ id: number; x: number; y: number } | null>(null);
  // Pointer movement updates every frame, so rotation stays outside React state.
  const rot = useRef({
    rx: 0,
    ry: 0,
    vx: 0,
    vy: 0,
    gx: 0,
    gy: 0,
    fx: 0,
    fy: 0,
    t0: 0,
    eased: false,
  });
  const [facing, setFacing] = useState<'front' | 'back'>('front');
  const [still, setStill] = useState(false);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setStill(query.matches);
    sync();
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);

  const paint = useCallback(() => {
    const el = slab.current;
    if (!el) return;
    const { rx, ry } = rot.current;
    // Keep transform rotation continuous, but wrap the angle used for lighting.
    const wrapped = ((((ry + 180) % 360) + 360) % 360) - 180;
    el.style.setProperty('--turn', ry.toFixed(2));
    el.style.setProperty('--rx', rx.toFixed(2));
    el.style.setProperty('--ry', wrapped.toFixed(2));
    // Fade the face as its normal turns away from the viewer.
    const rad = Math.PI / 180;
    const nz = Math.cos(rx * rad) * Math.cos(ry * rad);
    const dim = (1 - Math.abs(nz)).toFixed(3);
    el.style.setProperty('--dim', dim);
    el.parentElement?.style.setProperty('--dim', dim);
    const turn = ((ry % 360) + 360) % 360;
    setFacing(turn > 90 && turn < 270 ? 'back' : 'front');
  }, []);

  const run = useCallback(() => {
    cancelAnimationFrame(frame.current);
    const step = () => {
      const r = rot.current;
      let busy = false;
      if (r.eased) {
        // A fixed-duration tween avoids sub-degree settling that makes fine text shimmer.
        const p = Math.min(1, (performance.now() - r.t0) / TURN_MS);
        const e = 1 - Math.pow(1 - p, 3);
        r.rx = r.fx + (r.gx - r.fx) * e;
        r.ry = r.fy + (r.gy - r.fy) * e;
        if (p < 1) busy = true;
        else r.eased = false;
      } else if (!drag.current) {
        r.rx = Math.max(-MAX_TILT, Math.min(MAX_TILT, r.rx + r.vx));
        r.ry += r.vy;
        r.vx *= FRICTION;
        r.vy *= FRICTION;
        // Stop before sub-degree inertia becomes visible in fine text.
        if (Math.abs(r.vx) > 0.08 || Math.abs(r.vy) > 0.08) busy = true;
      }
      paint();
      if (busy) frame.current = requestAnimationFrame(step);
    };
    frame.current = requestAnimationFrame(step);
  }, [paint]);

  useEffect(() => {
    paint();
    return () => cancelAnimationFrame(frame.current);
  }, [paint]);

  function turnTo(gx: number, gy: number) {
    const r = rot.current;
    r.vx = 0;
    r.vy = 0;
    r.gx = gx;
    r.gy = shortest(r.ry, gy);
    if (still) {
      r.rx = r.gx;
      r.ry = r.gy;
      paint();
      return;
    }
    r.fx = r.rx;
    r.fy = r.ry;
    r.t0 = performance.now();
    r.eased = true;
    run();
  }

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
    rot.current.eased = false;
    rot.current.vx = 0;
    rot.current.vy = 0;
    cancelAnimationFrame(frame.current);
  }

  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    d.x = e.clientX;
    d.y = e.clientY;
    const r = rot.current;
    r.ry += dx * SPEED;
    r.rx = Math.max(-MAX_TILT, Math.min(MAX_TILT, r.rx - dy * SPEED));
    r.vy = dx * SPEED;
    r.vx = -dy * SPEED;
    paint();
  }

  function onPointerUp(e: ReactPointerEvent<HTMLDivElement>) {
    if (drag.current?.id !== e.pointerId) return;
    drag.current = null;
    const r = rot.current;
    const cap = (v: number) => Math.max(-MAX_THROW, Math.min(MAX_THROW, v * THROW));
    r.vx = cap(r.vx);
    r.vy = cap(r.vy);
    if (!still) run();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    const step = e.shiftKey ? 45 : 15;
    const r = rot.current;
    const keys: Record<string, () => void> = {
      ArrowLeft: () => turnTo(r.rx, r.ry - step),
      ArrowRight: () => turnTo(r.rx, r.ry + step),
      ArrowUp: () => turnTo(Math.max(-MAX_TILT, r.rx + step), r.ry),
      ArrowDown: () => turnTo(Math.min(MAX_TILT, r.rx - step), r.ry),
    };
    const act = keys[e.key];
    if (act) {
      e.preventDefault();
      act();
    }
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div
      className={styles.scrim}
      role="dialog"
      aria-modal="true"
      aria-label={`${card.title}, card inspection`}
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={styles.sheet}>
        <button type="button" className={styles.close} onClick={onClose} aria-label="Close">
          ×
        </button>

        <div
          className={styles.stage}
          style={
            {
              '--corner': CORNER[card.template_config.corners ?? 'round'] ?? CORNER.round,
            } as React.CSSProperties
          }
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onKeyDown={onKeyDown}
          tabIndex={0}
          role="img"
          aria-label={`${card.title}, showing the ${facing}. Use the arrow keys to turn it.`}
        >
          <span className={styles.floor} aria-hidden="true" />
          <div className={styles.slab} ref={slab}>
            <div className={styles.face}>
              <span className={styles.shade} aria-hidden="true" />
              <CardPreview
                lit
                size="large"
                title={card.title}
                rarity={card.rarity}
                number={card.position + 1}
                description={card.description}
                imageUrl={card.image.url}
                templateKey={card.template_key}
                templateConfig={card.template_config}
                mark={mark}
              />
            </div>
            <div className={styles.reverse}>
              <span className={styles.shade} aria-hidden="true" />
              <CardBack mark={mark} packColour={packColour} title={setTitle} />
            </div>
            {CORE_LAYERS.map((i) => (
              <span
                key={i}
                className={styles.core}
                style={{ '--i': i } as React.CSSProperties}
                aria-hidden="true"
              />
            ))}
          </div>
        </div>

        <div className={styles.controls}>
          <button type="button" className={styles.turn} onClick={() => turnTo(0, 0)}>
            Front
          </button>
          <button type="button" className={styles.turn} onClick={() => turnTo(0, 180)}>
            Back
          </button>
          <button
            type="button"
            className={styles.turn}
            onClick={() => turnTo(0, facing === 'back' ? 180 : 0)}
          >
            Level
          </button>
        </div>

        <div className={styles.meta}>
          <div className={styles.head}>
            <h2 className={styles.title}>{card.title}</h2>
            <span className={styles.rarity} data-rarity={card.rarity}>
              {RARITY_LABELS[card.rarity]}
            </span>
          </div>
          <p className={styles.from}>
            <Link href={`/sets/${setSlug}`}>{setTitle}</Link>
            {creator ? <> · {creator.display_name}</> : null}
            {copies ? ` · ${copies} ${copies === 1 ? 'copy' : 'copies'}` : ''}
          </p>
          {card.description ? (
            <Description text={card.description} className={styles.body} />
          ) : null}
          {actions ? <div className={styles.actions}>{actions}</div> : null}
        </div>
      </div>
    </div>
  );
}

export function OwnedCardInspector({ owned, onClose }: { owned: OwnedCard; onClose: () => void }) {
  return (
    <CardInspector
      card={owned.card}
      setTitle={owned.set_title}
      setSlug={owned.set_slug}
      mark={owned.set_mark}
      copies={owned.copies}
      onClose={onClose}
    />
  );
}

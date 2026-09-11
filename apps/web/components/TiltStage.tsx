'use client';

import { useCallback, useEffect, useRef } from 'react';
import type { PointerEvent as ReactPointerEvent, KeyboardEvent, ReactNode } from 'react';
import styles from './TiltStage.module.css';

const SPEED = 0.5;
const MAX = 45;
const SETTLE = 0.12;
const SLOP = 5;

export default function TiltStage({
  className,
  label = 'Turn the card',
  children,
}: {
  className?: string | undefined;
  label?: string;
  children: ReactNode;
}) {
  const stage = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: number; x: number; y: number; turning: boolean } | null>(null);
  const rot = useRef({ rx: 0, ry: 0 });
  const frame = useRef(0);

  const paint = useCallback(() => {
    const el = stage.current;
    if (!el) return;
    el.style.setProperty('--rx', rot.current.rx.toFixed(2));
    el.style.setProperty('--ry', rot.current.ry.toFixed(2));
  }, []);

  const settle = useCallback(() => {
    cancelAnimationFrame(frame.current);
    const step = () => {
      const r = rot.current;
      if (drag.current?.turning) return;
      r.rx += (0 - r.rx) * SETTLE;
      r.ry += (0 - r.ry) * SETTLE;
      paint();
      if (Math.abs(r.rx) > 0.05 || Math.abs(r.ry) > 0.05) {
        frame.current = requestAnimationFrame(step);
      } else {
        rot.current = { rx: 0, ry: 0 };
        paint();
      }
    };
    frame.current = requestAnimationFrame(step);
  }, [paint]);

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  function down(event: ReactPointerEvent<HTMLDivElement>) {
    drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, turning: false };
  }

  function move(event: ReactPointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d || d.id !== event.pointerId) return;
    const dx = event.clientX - d.x;
    const dy = event.clientY - d.y;
    if (!d.turning) {
      if (Math.hypot(dx, dy) < SLOP) return;
      d.turning = true;
      cancelAnimationFrame(frame.current);
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    d.x = event.clientX;
    d.y = event.clientY;
    const r = rot.current;
    r.ry = Math.max(-MAX, Math.min(MAX, r.ry + dx * SPEED));
    r.rx = Math.max(-MAX, Math.min(MAX, r.rx - dy * SPEED));
    paint();
  }

  function up(event: ReactPointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (d?.id !== event.pointerId) return;
    drag.current = null;
    if (!d.turning) return;
    const swallow = (click: Event) => {
      click.preventDefault();
      click.stopPropagation();
    };
    event.currentTarget.addEventListener('click', swallow, { capture: true, once: true });
    setTimeout(() => event.currentTarget?.removeEventListener('click', swallow, true), 0);
    settle();
  }

  function key(event: KeyboardEvent<HTMLDivElement>) {
    const r = rot.current;
    const step = 8;
    const moves: Record<string, () => void> = {
      ArrowLeft: () => (r.ry = Math.max(-MAX, r.ry - step)),
      ArrowRight: () => (r.ry = Math.min(MAX, r.ry + step)),
      ArrowUp: () => (r.rx = Math.min(MAX, r.rx + step)),
      ArrowDown: () => (r.rx = Math.max(-MAX, r.rx - step)),
    };
    const run = moves[event.key];
    if (!run) return;
    event.preventDefault();
    cancelAnimationFrame(frame.current);
    run();
    paint();
  }

  return (
    <div
      ref={stage}
      className={`${className ?? ''} ${styles.stage}`}
      role="group"
      aria-label={label}
      tabIndex={0}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      onKeyDown={key}
    >
      <div className={styles.slab}>{children}</div>
    </div>
  );
}

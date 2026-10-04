'use client';

import { useEffect, useRef } from 'react';
import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react';
import {
  ART_OFFSET_MAX,
  ART_OFFSET_MIN,
  ART_SCALE_MAX,
  ART_SCALE_MIN,
  BADGE_SCALE_MAX,
  SCALE_MIN,
} from '@/lib/setIdentity';
import type { PackLayer } from '@/lib/setIdentity';
import styles from './PackDesigner.module.css';

type Point = { x: number; y: number };

// Drag the open layer to move it, and pinch or scroll to resize it, directly on the pack preview.
export default function PackGestures({
  layer,
  onChange,
  children,
}: {
  layer: PackLayer | null;
  onChange: (patch: Partial<PackLayer>, save: boolean) => void;
  children: ReactNode;
}) {
  const box = useRef<HTMLDivElement>(null);
  const gesture = useRef<{
    layer: PackLayer;
    points: Map<number, Point>;
    start: Map<number, Point>;
  } | null>(null);
  const latest = useRef({ layer, onChange });
  latest.current = { layer, onChange };
  const save = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const el = box.current;
    if (!el || !layer) return;
    const wheel = (event: WheelEvent) => {
      const current = latest.current.layer;
      if (!current) return;
      event.preventDefault();
      const scale = clampScale(current, current.scale * Math.exp(-event.deltaY * 0.0015));
      latest.current.onChange({ scale }, false);
      if (save.current) clearTimeout(save.current);
      save.current = setTimeout(() => latest.current.onChange({ scale }, true), 400);
    };
    el.addEventListener('wheel', wheel, { passive: false });
    return () => el.removeEventListener('wheel', wheel);
  }, [layer]);

  function restart() {
    const current = gesture.current;
    if (!current || !latest.current.layer) return;
    current.layer = latest.current.layer;
    current.start = new Map(current.points);
  }

  function down(event: ReactPointerEvent<HTMLDivElement>) {
    if (!layer || event.button > 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    if (!gesture.current) gesture.current = { layer, points: new Map(), start: new Map() };
    gesture.current.points.set(event.pointerId, { x: event.clientX, y: event.clientY });
    restart();
  }

  function move(event: ReactPointerEvent<HTMLDivElement>) {
    const current = gesture.current;
    const rect = box.current?.getBoundingClientRect();
    if (!current || !rect || !current.points.has(event.pointerId)) return;
    current.points.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const ids = [...current.start.keys()].filter((id) => current.points.has(id));
    if (ids.length >= 2) {
      const [a, b] = ids as [number, number];
      const before = distance(current.start.get(a)!, current.start.get(b)!);
      const now = distance(current.points.get(a)!, current.points.get(b)!);
      if (before > 0)
        onChange({ scale: clampScale(current.layer, current.layer.scale * (now / before)) }, false);
      return;
    }
    const id = ids[0];
    if (id === undefined) return;
    const from = current.start.get(id)!;
    const to = current.points.get(id)!;
    onChange(
      {
        x: clampOffset(current.layer.x + ((to.x - from.x) / rect.width) * 100),
        y: clampOffset(current.layer.y + ((to.y - from.y) / rect.height) * 100),
      },
      false,
    );
  }

  function up(event: ReactPointerEvent<HTMLDivElement>) {
    const current = gesture.current;
    if (!current?.points.delete(event.pointerId)) return;
    if (current.points.size) {
      restart();
      return;
    }
    gesture.current = null;
    const now = latest.current.layer;
    if (now) onChange({ x: now.x, y: now.y, scale: now.scale }, true);
  }

  return (
    <div
      ref={box}
      className={layer ? styles.gestures : undefined}
      title={layer ? 'Drag to move the open layer; pinch or scroll to resize it' : undefined}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
    >
      {children}
    </div>
  );
}

function clampScale(layer: PackLayer, value: number) {
  const max = layer.kind === 'emblem' ? BADGE_SCALE_MAX : ART_SCALE_MAX;
  const min = layer.kind === 'emblem' ? SCALE_MIN : ART_SCALE_MIN;
  return Math.round(Math.min(max, Math.max(min, value)));
}

function clampOffset(value: number) {
  return Math.round(Math.min(ART_OFFSET_MAX, Math.max(ART_OFFSET_MIN, value)));
}

function distance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

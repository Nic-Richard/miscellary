'use client';

import { useEffect, useRef } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';
import { PHOTO_ZOOM_MAX } from '@miscellary/shared';
import type { PhotoFrame } from '@miscellary/shared';
import styles from './CardPreview.module.css';

type Gesture = {
  frame: PhotoFrame;
  points: Map<number, { x: number; y: number }>;
  start: Map<number, { x: number; y: number }>;
};

export default function CardPhoto({
  src,
  frame,
  onFrameChange,
}: {
  src: string;
  frame: PhotoFrame;
  onFrameChange?: ((frame: PhotoFrame) => void) | undefined;
}) {
  const img = useRef<HTMLImageElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const latest = useRef({ frame, onFrameChange });
  latest.current = { frame, onFrameChange };

  // React's wheel listener is passive, so zooming has to cancel the page scroll natively.
  useEffect(() => {
    const el = img.current;
    if (!el || !onFrameChange) return;
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      const { frame: current, onFrameChange: change } = latest.current;
      change?.({ ...current, zoom: clampZoom(current.zoom * Math.exp(-event.deltaY * 0.0015)) });
    };
    el.addEventListener('wheel', wheel, { passive: false });
    return () => el.removeEventListener('wheel', wheel);
  }, [onFrameChange]);

  // Each finger added or lifted starts the gesture again from the frame as it is now.
  function restart() {
    const current = gesture.current;
    if (!current) return;
    current.frame = latest.current.frame;
    current.start = new Map(current.points);
  }

  function start(event: ReactPointerEvent<HTMLImageElement>) {
    if (!onFrameChange) return;
    // Keeps the drag from also tilting the card in the editor's stage.
    event.stopPropagation();
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    if (!gesture.current) gesture.current = { frame, points: new Map(), start: new Map() };
    gesture.current.points.set(event.pointerId, { x: event.clientX, y: event.clientY });
    restart();
  }

  function move(event: ReactPointerEvent<HTMLImageElement>) {
    const current = gesture.current;
    const el = img.current;
    if (!onFrameChange || !current || !current.points.has(event.pointerId) || !el) return;
    event.stopPropagation();
    current.points.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const ids = [...current.start.keys()].filter((id) => current.points.has(id));

    if (ids.length >= 2) {
      const [a, b] = ids as [number, number];
      const before = distance(current.start.get(a)!, current.start.get(b)!);
      const now = distance(current.points.get(a)!, current.points.get(b)!);
      if (before > 0)
        onFrameChange({ ...current.frame, zoom: clampZoom(current.frame.zoom * (now / before)) });
      return;
    }

    const id = ids[0];
    if (id === undefined) return;
    const from = current.start.get(id)!;
    const to = current.points.get(id)!;
    // The photo's own box can be rotated (diamond windows), so measure its
    // layout size and scale it by how large the card is drawn on screen.
    const card = el.closest<HTMLElement>(`.${styles.card}`);
    const onScreen = card?.offsetWidth ? card.getBoundingClientRect().width / card.offsetWidth : 1;
    const w = el.offsetWidth * onScreen;
    const h = el.offsetHeight * onScreen;
    const { naturalWidth: nw, naturalHeight: nh } = el;
    if (!nw || !nh || !w || !h) return;
    // Scaling about the focal point, a 0-100% move shifts the photo by
    // zoom × cover-fitted size − window size.
    const zoom = current.frame.zoom;
    const cover = Math.max(w / nw, h / nh);
    const spanX = nw * cover * zoom - w;
    const spanY = nh * cover * zoom - h;
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    onFrameChange({
      zoom,
      x: spanX > 0.5 ? clamp(current.frame.x - (dx / spanX) * 100) : current.frame.x,
      y: spanY > 0.5 ? clamp(current.frame.y - (dy / spanY) * 100) : current.frame.y,
    });
  }

  function end(event: ReactPointerEvent<HTMLImageElement>) {
    const current = gesture.current;
    if (!current?.points.delete(event.pointerId)) return;
    if (current.points.size === 0) gesture.current = null;
    else restart();
  }

  return (
    <img
      ref={img}
      src={src}
      alt=""
      draggable={false}
      className={onFrameChange ? styles.framing : undefined}
      style={
        {
          objectPosition: `${frame.x}% ${frame.y}%`,
          '--photo-zoom': frame.zoom,
          '--photo-dx': `${frame.x - 50}%`,
          '--photo-dy': `${frame.y - 50}%`,
        } as CSSProperties
      }
      onPointerDown={start}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
    />
  );
}

function clamp(value: number) {
  return Math.min(100, Math.max(0, value));
}

function clampZoom(value: number) {
  return Math.min(PHOTO_ZOOM_MAX, Math.max(1, Math.round(value * 100) / 100));
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

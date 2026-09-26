'use client';

import { useRef } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { PhotoFrame } from '@miscellary/shared';
import styles from './CardPreview.module.css';

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
  const drag = useRef<{ id: number; x: number; y: number; frame: PhotoFrame } | null>(null);

  function start(event: ReactPointerEvent<HTMLImageElement>) {
    if (!onFrameChange) return;
    // Keeps the drag from also tilting the card in the editor's stage.
    event.stopPropagation();
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, frame };
  }

  function move(event: ReactPointerEvent<HTMLImageElement>) {
    const current = drag.current;
    const el = img.current;
    if (!onFrameChange || !current || current.id !== event.pointerId || !el) return;
    event.stopPropagation();
    const box = el.getBoundingClientRect();
    const { naturalWidth: nw, naturalHeight: nh } = el;
    if (!nw || !nh || !box.width || !box.height) return;
    // Scaling about the focal point, a 0-100% move shifts the photo by
    // zoom × cover-fitted size − window size (the box is already scaled).
    const zoom = current.frame.zoom;
    const cover = Math.max(box.width / zoom / nw, box.height / zoom / nh);
    const spanX = nw * cover * zoom - box.width / zoom;
    const spanY = nh * cover * zoom - box.height / zoom;
    const dx = event.clientX - current.x;
    const dy = event.clientY - current.y;
    onFrameChange({
      zoom,
      x: spanX > 0.5 ? clamp(current.frame.x - (dx / spanX) * 100) : current.frame.x,
      y: spanY > 0.5 ? clamp(current.frame.y - (dy / spanY) * 100) : current.frame.y,
    });
  }

  function end(event: ReactPointerEvent<HTMLImageElement>) {
    if (drag.current?.id === event.pointerId) drag.current = null;
  }

  return (
    <img
      ref={img}
      src={src}
      alt=""
      draggable={false}
      className={onFrameChange ? styles.framing : undefined}
      style={{
        objectPosition: `${frame.x}% ${frame.y}%`,
        transformOrigin: `${frame.x}% ${frame.y}%`,
        transform: frame.zoom > 1 ? `scale(${frame.zoom})` : undefined,
      }}
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

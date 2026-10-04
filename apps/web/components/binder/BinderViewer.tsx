'use client';

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { ReactNode } from 'react';
import styles from './BinderViewer.module.css';

// The binder on its own over the page, sized to the screen. On a phone it also asks for full screen in
// landscape, which browsers only grant from a tap and may refuse; the overlay works either way.
export default function BinderViewer({
  title,
  subtitle,
  spread,
  spreads,
  onTurn,
  onClose,
  paused = false,
  children,
}: {
  title: string;
  subtitle: string;
  spread: number;
  spreads: number;
  onTurn: (direction: -1 | 1) => void;
  onClose: () => void;
  /** True while something opened from the binder, such as the inspector, owns the keyboard. */
  paused?: boolean;
  children: ReactNode;
}) {
  const root = useRef<HTMLDivElement>(null);
  const latest = useRef({ onTurn, onClose, paused });
  latest.current = { onTurn, onClose, paused };

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    root.current?.focus();
    const phone = window.matchMedia('(pointer: coarse) and (max-width: 900px)').matches;
    if (phone && document.fullscreenEnabled) {
      // The whole page, so the inspector opened from a card still shows above the binder.
      document.documentElement
        .requestFullscreen()
        .then(() =>
          (screen.orientation as { lock?: (o: string) => Promise<void> }).lock?.('landscape'),
        )
        .catch(() => undefined);
    }
    function onKey(event: KeyboardEvent) {
      if (latest.current.paused) return;
      if (event.key === 'Escape') latest.current.onClose();
      if (event.key === 'ArrowLeft') latest.current.onTurn(-1);
      if (event.key === 'ArrowRight') latest.current.onTurn(1);
    }
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    };
  }, []);

  // Drawn at the top of the page so a contained or transformed layout cannot clip or cover it.
  return createPortal(
    <div
      ref={root}
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-label={`${title} binder`}
      tabIndex={-1}
    >
      <div className={styles.title}>
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </div>
      <button
        type="button"
        className={`${styles.round} ${styles.close}`}
        aria-label="Close binder"
        onClick={onClose}
      >
        ✕
      </button>
      <button
        type="button"
        className={`${styles.round} ${styles.prev}`}
        aria-label="Previous pages"
        disabled={spread === 0}
        onClick={() => onTurn(-1)}
      >
        ‹
      </button>
      <div className={styles.binder}>{children}</div>
      <button
        type="button"
        className={`${styles.round} ${styles.next}`}
        aria-label="Next pages"
        disabled={spread >= spreads - 1}
        onClick={() => onTurn(1)}
      >
        ›
      </button>
      <p className={styles.pages}>
        Pages {spread * 2 + 1}–{spread * 2 + 2} of {spreads * 2}
      </p>
    </div>,
    document.body,
  );
}

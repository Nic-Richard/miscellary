'use client';

import Link from 'next/link';
import { Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react';
import ui from './ui.module.css';
import styles from './MoreMenu.module.css';

export type MoreItem =
  | { label: string; href: string; danger?: boolean }
  | { label: string; onSelect: () => void; danger?: boolean };

export default function MoreMenu({
  label,
  items,
  opens = 'left',
}: {
  label: string;
  items: MoreItem[];
  opens?: 'left' | 'right';
}) {
  const [open, setOpen] = useState(false);
  const [side, setSide] = useState(opens);
  const root = useRef<HTMLDivElement>(null);
  const menu = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open) return setSide(opens);
    const box = menu.current?.getBoundingClientRect();
    // Flips once, away from the preferred side, so a menu too wide for either side cannot loop.
    if (!box || side !== opens) return;
    if (side === 'right' && box.right > window.innerWidth - 8) setSide('left');
    if (side === 'left' && box.left < 8) setSide('right');
  }, [open, opens, side]);

  useEffect(() => {
    if (!open) return;
    function away(event: MouseEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    function escape(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('mousedown', away);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);

  if (items.length === 0) return null;

  return (
    <div className={styles.root} ref={root}>
      <button
        type="button"
        className={`${ui.action} ${styles.trigger}`}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="5" cy="12" r="1.3" />
          <circle cx="12" cy="12" r="1.3" />
          <circle cx="19" cy="12" r="1.3" />
        </svg>
      </button>
      {open ? (
        <div
          ref={menu}
          className={`${styles.menu} ${side === 'right' ? styles.menuRight : ''}`}
          role="menu"
        >
          {items.map((item, index) => (
            <Fragment key={item.label}>
              {item.danger && index > 0 && !items[index - 1]!.danger ? (
                <hr className={styles.rule} />
              ) : null}
              {'href' in item ? (
                <Link
                  role="menuitem"
                  href={item.href}
                  className={item.danger ? styles.danger : undefined}
                >
                  {item.label}
                </Link>
              ) : (
                <button
                  type="button"
                  role="menuitem"
                  className={item.danger ? styles.danger : undefined}
                  onClick={() => {
                    setOpen(false);
                    item.onSelect();
                  }}
                >
                  {item.label}
                </button>
              )}
            </Fragment>
          ))}
        </div>
      ) : null}
    </div>
  );
}

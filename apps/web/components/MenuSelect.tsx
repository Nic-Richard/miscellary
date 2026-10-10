'use client';

import { useEffect, useId, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import ui from './ui.module.css';
import styles from './MoreMenu.module.css';

export default function MenuSelect<T extends string>({
  label,
  value,
  options,
  onChange,
  small = false,
}: {
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
  small?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const list = useId();
  const current = options.find((option) => option.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    setActive(
      Math.max(
        0,
        options.findIndex((option) => option.value === value),
      ),
    );
    function away(event: MouseEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', away);
    return () => document.removeEventListener('mousedown', away);
  }, [open, options, value]);

  function choose(next: T) {
    onChange(next);
    setOpen(false);
    button.current?.focus();
  }

  function onKey(event: KeyboardEvent) {
    if (event.key === 'Escape' && open) {
      event.preventDefault();
      setOpen(false);
      button.current?.focus();
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) return setOpen(true);
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setActive((index) => (index + step + options.length) % options.length);
    } else if ((event.key === 'Enter' || event.key === ' ') && open) {
      event.preventDefault();
      choose(options[active]!.value);
    }
  }

  return (
    <div className={styles.root} ref={root} onKeyDown={onKey}>
      <button
        ref={button}
        type="button"
        className={`${ui.btnOutline} ${small ? ui.btnSmall : ''} ${styles.select}`}
        aria-label={`${label}: ${current?.label}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? list : undefined}
        onClick={() => setOpen((state) => !state)}
      >
        {current?.label}
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open ? (
        <div
          id={list}
          className={`${styles.menu} ${styles.menuRight}`}
          role="listbox"
          aria-label={label}
          aria-activedescendant={`${list}-${active}`}
        >
          {options.map((option, index) => (
            <button
              key={option.value}
              id={`${list}-${index}`}
              type="button"
              role="option"
              aria-selected={option.value === value}
              className={index === active ? styles.active : undefined}
              onMouseEnter={() => setActive(index)}
              onClick={() => choose(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

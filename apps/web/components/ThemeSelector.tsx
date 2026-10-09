'use client';

import { DEFAULT_THEME, THEMES, THEME_GROUPS, getTheme } from '@miscellary/shared';
import type { Theme } from '@miscellary/shared';
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '@/lib/auth';
import styles from './ThemeSelector.module.css';

function Swatches({ theme }: { theme: Theme }) {
  return (
    <span className={styles.swatches} aria-hidden="true">
      {[theme.bg, theme.sur, theme.accent].map((color, index) => (
        <i key={index} style={{ background: color }} />
      ))}
    </span>
  );
}

export default function ThemeSelector({ rail = false }: { rail?: boolean }) {
  const { user, updateTheme } = useAuth();
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const theme = getTheme(user?.theme);

  useLayoutEffect(() => {
    if (!open) return;
    function place() {
      const anchor = trigger.current?.getBoundingClientRect();
      const box = menu.current?.getBoundingClientRect();
      if (!anchor || !box) return;
      if (anchor.width === 0) return setOpen(false);
      const below = anchor.bottom + 6;
      const top = below + box.height <= innerHeight - 12 ? below : anchor.top - box.height - 6;
      setPosition({
        top: Math.max(12, Math.min(top, innerHeight - box.height - 12)),
        left: Math.max(12, Math.min(anchor.left, innerWidth - box.width - 12)),
      });
    }
    place();
    menu.current?.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function away(event: PointerEvent) {
      const target = event.target as Node;
      if (!trigger.current?.contains(target) && !menu.current?.contains(target)) setOpen(false);
    }
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, [open]);

  if (!user) return null;

  async function choose(next: string) {
    if (busy) return;
    setOpen(false);
    trigger.current?.focus();
    if (next === theme.id) return;
    setBusy(true);
    setError(null);
    try {
      await updateTheme(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your theme.');
    } finally {
      setBusy(false);
    }
  }

  function navigate(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape' || event.key === 'Tab') {
      if (event.key === 'Escape') event.preventDefault();
      setOpen(false);
      trigger.current?.focus();
      return;
    }
    const buttons = Array.from(
      menu.current?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]') ?? [],
    );
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    let next: number;
    if (event.key === 'ArrowDown') next = (index + 1) % buttons.length;
    else if (event.key === 'ArrowUp') next = (index - 1 + buttons.length) % buttons.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = buttons.length - 1;
    else return;
    event.preventDefault();
    buttons[next]?.focus();
  }

  return (
    <div className={`${styles.wrap} ${rail ? styles.rail : ''}`}>
      <span id={`${id}-label`} className={styles.label}>
        Colour theme
      </span>
      <button
        ref={trigger}
        type="button"
        className={styles.trigger}
        aria-labelledby={`${id}-label ${id}-name`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? `${id}-menu` : undefined}
        aria-disabled={busy}
        onClick={() => !busy && setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (!busy && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
            event.preventDefault();
            setOpen(true);
          }
        }}
        aria-describedby={error ? `${id}-error` : undefined}
      >
        <Swatches theme={theme} />
        <span id={`${id}-name`} className={styles.name}>
          {theme.name}
        </span>
        <span aria-hidden="true">⌄</span>
      </button>
      {busy && <span role="status">Saving…</span>}
      {error && (
        <p id={`${id}-error`} role="alert">
          {error}
        </p>
      )}
      {open &&
        createPortal(
          <div
            ref={menu}
            id={`${id}-menu`}
            role="menu"
            aria-label="Colour theme"
            className={styles.menu}
            style={position}
            onKeyDown={navigate}
          >
            {THEME_GROUPS.map((group) => (
              <section key={group} role="group" aria-label={group}>
                <h3>{group}</h3>
                {THEMES.filter((option) => option.group === group).map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    role="menuitemradio"
                    aria-checked={option.id === theme.id}
                    tabIndex={-1}
                    onClick={() => void choose(option.id)}
                  >
                    <Swatches theme={option} />
                    <span className={styles.name}>
                      {option.name}
                      {option.id === DEFAULT_THEME && <small>Default</small>}
                    </span>
                    <span className={styles.check} aria-hidden="true">
                      {option.id === theme.id ? '✓' : ''}
                    </span>
                  </button>
                ))}
              </section>
            ))}
          </div>,
          document.body,
        )}
    </div>
  );
}

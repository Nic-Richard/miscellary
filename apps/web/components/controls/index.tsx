'use client';

import { createContext, useContext, useEffect, useId, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { HexColorInput, HexColorPicker } from 'react-colorful';
import { isHexColour } from '@miscellary/shared';
import { colourRows, swatchColour } from '@/lib/palette';
import styles from './Controls.module.css';

const FieldLabelContext = createContext<string | undefined>(undefined);

export function Field({ label, children }: { label: string; children: ReactNode }) {
  const labelId = useId();
  return (
    <div className={styles.field} role="group" aria-labelledby={labelId}>
      <span className={styles.label} id={labelId}>
        {label}
      </span>
      <FieldLabelContext.Provider value={label}>
        <div className={styles.value}>{children}</div>
      </FieldLabelContext.Provider>
    </div>
  );
}

export function Section({
  title,
  note,
  defaultOpen = true,
  children,
}: {
  title: string;
  note?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  return (
    <section className={`${styles.section} ${open ? styles.sectionOpen : ''}`}>
      <button
        type="button"
        className={styles.sectionHead}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(!open)}
      >
        {title}
        <span className={styles.caret}>▶</span>
      </button>
      {open ? (
        <div className={styles.sectionBody} id={id}>
          {note ? <p className={styles.sectionNote}>{note}</p> : null}
          {children}
        </div>
      ) : null}
    </section>
  );
}

function useDismiss(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) close();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') close();
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, close]);
  return ref;
}

function named(labels: Record<string, string> | undefined, token: string): string {
  if (isHexColour(token)) return token.toUpperCase();
  return labels?.[token] ?? token.charAt(0).toUpperCase() + token.slice(1);
}

function Swatch({ token, swatchFor }: { token: string; swatchFor: SwatchFor }) {
  if (token === 'rarity') return <span className={`${styles.chip} ${styles.chipRarity}`} />;
  return <span className={styles.chip} style={swatchFor(token)} />;
}

export type SwatchFor = (token: string) => CSSProperties;

const hexSwatch: SwatchFor = (token) => ({ background: swatchColour(token) });

export interface MenuProps {
  value: string;
  values: string[];
  onChange: (value: string) => void;
  swatchFor?: SwatchFor;
  labels?: Record<string, string>;
  locks?: Record<string, string>;
  align?: 'left' | 'right';
}

const RECENT_KEY = 'miscellary:custom-colours';
const RECENT_MAX = 6;

function recentColours(): string[] {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]');
    return Array.isArray(stored) ? stored.filter(isHexColour).slice(0, RECENT_MAX) : [];
  } catch {
    return [];
  }
}

function rememberColour(hex: string) {
  try {
    const next = [hex, ...recentColours().filter((c) => c !== hex)].slice(0, RECENT_MAX);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // Recent colours are a convenience; the pick itself is already applied.
  }
}

interface EyeDropperWindow {
  EyeDropper?: new () => { open: () => Promise<{ sRGBHex: string }> };
}

function CustomColour({
  start,
  onChange,
  onDone,
}: {
  start: string;
  onChange: (hex: string) => void;
  onDone: (hex: string) => void;
}) {
  const [hex, setHex] = useState(start);
  const [dropper, setDropper] = useState(false);
  useEffect(() => setDropper('EyeDropper' in window), []);

  function change(next: string) {
    const clean = next.toLowerCase();
    setHex(clean);
    if (isHexColour(clean)) onChange(clean);
  }

  async function sample() {
    const Dropper = (window as EyeDropperWindow).EyeDropper;
    if (!Dropper) return;
    try {
      change((await new Dropper().open()).sRGBHex);
    } catch {
      // Dismissed with Escape.
    }
  }

  return (
    <div className={styles.custom}>
      <HexColorPicker className={styles.customPicker} color={hex} onChange={change} />
      <div className={styles.customRow}>
        <span className={styles.chip} style={{ background: hex }} />
        <HexColorInput
          className={styles.customHex}
          aria-label="Hex colour"
          prefixed
          color={hex}
          onChange={change}
        />
        {dropper ? (
          <button
            type="button"
            className={styles.customTool}
            title="Pick a colour from the screen"
            aria-label="Pick a colour from the screen"
            onClick={sample}
          >
            <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
              <path
                d="M14.5 5.5l4 4M12 8l4 4-8.5 8.5H4v-3.5L12 8zm3.5-5.5a2.1 2.1 0 013 0l3 3a2.1 2.1 0 010 3L19 11l-6-6 2.5-2.5z"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        ) : null}
        <button type="button" className={styles.customDone} onClick={() => onDone(hex)}>
          Done
        </button>
      </div>
    </div>
  );
}

export function ColourMenu({
  value,
  values,
  onChange,
  swatchFor: givenSwatch,
  labels,
  locks,
  align = 'left',
  custom = false,
}: MenuProps & { custom?: boolean }) {
  const fieldLabel = useContext(FieldLabelContext);
  const [open, setOpen] = useState(false);
  const [picking, setPicking] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const latest = useRef(value);
  latest.current = value;
  const ref = useDismiss(open, close);
  const swatchFor = givenSwatch ?? hexSwatch;
  const rows = colourRows(values);
  const hasRarity = values.includes('rarity');
  const name = (v: string) => named(labels, v);
  const customRow = [...new Set([...(isHexColour(value) ? [value] : []), ...recent])].slice(
    0,
    RECENT_MAX,
  );

  function close() {
    if (picking && isHexColour(latest.current)) rememberColour(latest.current);
    setPicking(false);
    setOpen(false);
  }

  function toggle() {
    if (open) return close();
    setRecent(recentColours());
    setOpen(true);
  }

  function pick(v: string) {
    onChange(v);
    close();
  }

  return (
    <div className={styles.anchor} ref={ref}>
      <button
        type="button"
        className={styles.trigger}
        aria-label={fieldLabel ? `${fieldLabel}: ${value}` : undefined}
        aria-expanded={open}
        aria-haspopup="true"
        onClick={toggle}
      >
        <Swatch token={value} swatchFor={swatchFor} />
        <span className={styles.triggerName}>{name(value)}</span>
        <span className={styles.triggerCaret}>▼</span>
      </button>
      {open && picking ? (
        <div className={`${styles.popover} ${align === 'right' ? styles.popoverRight : ''}`}>
          <CustomColour
            start={isHexColour(value) ? value : swatchColour(value)}
            onChange={onChange}
            onDone={(hex) => {
              if (isHexColour(hex)) onChange(hex);
              close();
            }}
          />
        </div>
      ) : open ? (
        <div className={`${styles.popover} ${align === 'right' ? styles.popoverRight : ''}`}>
          {values.includes('auto') ? (
            <button
              type="button"
              className={`${styles.special} ${value === 'auto' ? styles.specialOn : ''}`}
              onClick={() => pick('auto')}
            >
              {name('auto')}
            </button>
          ) : null}
          {hasRarity ? (
            <button
              type="button"
              className={`${styles.special} ${value === 'rarity' ? styles.specialOn : ''}`}
              onClick={() => pick('rarity')}
            >
              Follow the rarity colour
            </button>
          ) : null}
          <div className={styles.swatchRows}>
            {rows.map((row, index) => (
              <div key={index} className={styles.swatches}>
                {row.map((v) => {
                  const shut = locks?.[v];
                  const title = shut ? `${name(v)} - needs ${shut}` : name(v);
                  return (
                    <button
                      key={v}
                      type="button"
                      title={title}
                      aria-label={title}
                      aria-pressed={value === v}
                      disabled={!!shut}
                      className={`${styles.swatch} ${value === v ? styles.swatchOn : ''} ${
                        shut ? styles.swatchShut : ''
                      }`}
                      style={swatchFor(v)}
                      onClick={() => pick(v)}
                    />
                  );
                })}
              </div>
            ))}
            {custom ? (
              <div className={styles.swatches}>
                {Array.from({ length: RECENT_MAX }, (_, i) => {
                  const hex = customRow[i];
                  if (!hex) return <span key={i} className={styles.swatchEmpty} />;
                  return (
                    <button
                      key={hex}
                      type="button"
                      title={hex.toUpperCase()}
                      aria-label={hex.toUpperCase()}
                      aria-pressed={value === hex}
                      className={`${styles.swatch} ${value === hex ? styles.swatchOn : ''}`}
                      style={{ background: hex }}
                      onClick={() => {
                        rememberColour(hex);
                        pick(hex);
                      }}
                    />
                  );
                })}
                <button
                  type="button"
                  className={styles.customOpen}
                  onClick={() => setPicking(true)}
                >
                  Custom
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function ChoiceMenu({ value, values, onChange, labels, locks, align = 'left' }: MenuProps) {
  const fieldLabel = useContext(FieldLabelContext);
  const [open, setOpen] = useState(false);
  const ref = useDismiss(open, () => setOpen(false));
  const name = (v: string) => named(labels, v);

  return (
    <div className={styles.anchor} ref={ref}>
      <button
        type="button"
        className={styles.trigger}
        aria-label={fieldLabel ? `${fieldLabel}: ${name(value)}` : undefined}
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen(!open)}
      >
        <span className={styles.triggerName}>{name(value)}</span>
        <span className={styles.triggerCaret}>▼</span>
      </button>
      {open ? (
        <div className={`${styles.popover} ${align === 'right' ? styles.popoverRight : ''}`}>
          <div className={styles.choices}>
            {values.map((v) => {
              const shut = locks?.[v];
              return (
                <button
                  key={v}
                  type="button"
                  aria-pressed={value === v}
                  disabled={!!shut}
                  className={`${styles.choice} ${value === v ? styles.choiceOn : ''}`}
                  onClick={() => {
                    onChange(v);
                    setOpen(false);
                  }}
                >
                  {name(v)}
                  {shut ? <span className={styles.lock}>{shut}</span> : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function Segmented({
  value,
  values,
  onChange,
  labels,
}: {
  value: string;
  values: string[];
  onChange: (value: string) => void;
  labels?: Record<string, string>;
}) {
  const fieldLabel = useContext(FieldLabelContext);
  return (
    <div className={styles.segmented} role="group" aria-label={fieldLabel}>
      {values.map((v) => (
        <button
          key={v}
          type="button"
          aria-pressed={value === v}
          className={`${styles.segment} ${value === v ? styles.segmentOn : ''}`}
          onClick={() => onChange(v)}
        >
          {named(labels, v)}
        </button>
      ))}
    </div>
  );
}

export function TileGrid({
  value,
  values,
  onChange,
  labels,
  locks,
  tileFor,
}: {
  value: string;
  values: string[];
  onChange: (value: string) => void;
  labels?: Record<string, string>;
  locks?: Record<string, string>;
  tileFor: (value: string) => CSSProperties;
}) {
  const fieldLabel = useContext(FieldLabelContext);
  return (
    <div className={styles.tiles} role="group" aria-label={fieldLabel}>
      {values.map((v) => {
        const shut = locks?.[v];
        const name = named(labels, v);
        return (
          <button
            key={v}
            type="button"
            aria-pressed={value === v}
            aria-label={shut ? `${name}, needs ${shut}` : name}
            disabled={!!shut}
            className={`${styles.tile} ${value === v ? styles.tileOn : ''}`}
            onClick={() => onChange(v)}
          >
            <span
              className={`${styles.tileFace} ${shut ? styles.tileShut : ''}`}
              style={tileFor(v)}
            />
            <span className={styles.tileName}>
              {name}
              {shut ? <em className={styles.tileLock}>{shut}</em> : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// Dragging commits once; typed values remain unclamped until blur or Enter.
export function Slider({
  value,
  min,
  max,
  step = 1,
  suffix = '',
  onChange,
  onCommit,
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  onChange: (value: number) => void;
  onCommit: (value: number) => void;
}) {
  const fieldLabel = useContext(FieldLabelContext);
  const [typed, setTyped] = useState<string | null>(null);

  function commitTyped() {
    const parsed = Number(typed);
    setTyped(null);
    if (typed === null || typed.trim() === '' || Number.isNaN(parsed)) return;
    const clamped = Math.min(max, Math.max(min, Math.round(parsed / step) * step));
    onChange(clamped);
    onCommit(clamped);
  }

  return (
    <div className={styles.sliderRow}>
      <input
        type="range"
        aria-label={fieldLabel}
        className={styles.slider}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        onPointerUp={() => onCommit(value)}
        onKeyUp={() => onCommit(value)}
        onBlur={() => onCommit(value)}
      />
      <label className={styles.readout}>
        <input
          type="text"
          aria-label={fieldLabel ? `${fieldLabel} value` : 'Value'}
          inputMode="numeric"
          className={styles.readoutInput}
          value={typed ?? String(value)}
          onChange={(e) => setTyped(e.target.value)}
          onBlur={commitTyped}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              e.currentTarget.blur();
            } else if (e.key === 'Escape') {
              setTyped(null);
              e.currentTarget.blur();
            }
          }}
        />
        {suffix ? <span className={styles.readoutSuffix}>{suffix}</span> : null}
      </label>
    </div>
  );
}

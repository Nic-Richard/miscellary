'use client';

import { createContext, useContext, useEffect, useId, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { INK_FAMILIES, STOCK_FAMILIES, groupValues, swatchColour } from '@/lib/palette';
import type { Family } from '@/lib/palette';
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

// Close on outside click or Escape so menus cannot stack open.
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
  palette?: 'ink' | 'stock';
  families?: Family[];
  swatchFor?: SwatchFor;
  labels?: Record<string, string>;
  /** Values this card cannot use yet, mapped to the tier that opens them.
      Locked values stay visible so the ladder is legible from any tier. */
  locks?: Record<string, string>;
  align?: 'left' | 'right';
}

export function ColourMenu({
  value,
  values,
  onChange,
  palette = 'ink',
  families: given,
  swatchFor = hexSwatch,
  labels,
  locks,
  align = 'left',
}: MenuProps) {
  const fieldLabel = useContext(FieldLabelContext);
  const [open, setOpen] = useState(false);
  const ref = useDismiss(open, () => setOpen(false));
  const base: Family[] = given ?? (palette === 'stock' ? STOCK_FAMILIES : INK_FAMILIES);
  const families = groupValues(values, base);
  const hasRarity = values.includes('rarity');
  const name = (v: string) => named(labels, v);

  function pick(v: string) {
    onChange(v);
    setOpen(false);
  }

  return (
    <div className={styles.anchor} ref={ref}>
      <button
        type="button"
        className={styles.trigger}
        aria-label={fieldLabel ? `${fieldLabel}: ${value}` : undefined}
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen(!open)}
      >
        <Swatch token={value} swatchFor={swatchFor} />
        <span className={styles.triggerName}>{name(value)}</span>
        <span className={styles.triggerCaret}>▼</span>
      </button>
      {open ? (
        <div className={`${styles.popover} ${align === 'right' ? styles.popoverRight : ''}`}>
          {hasRarity ? (
            <button
              type="button"
              className={`${styles.special} ${value === 'rarity' ? styles.specialOn : ''}`}
              onClick={() => pick('rarity')}
            >
              Follow the rarity colour
            </button>
          ) : null}
          <div className={styles.families}>
            {families.map((family) => (
              <div key={family.label} className={styles.family}>
                <span className={styles.familyLabel}>{family.label}</span>
                <div className={styles.swatches}>
                  {family.values.map((v) => {
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
              </div>
            ))}
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

/** A grid of rendered samples, for options whose names mean nothing on their
    own: choosing a surface or a coat should show the material, not the word. */
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

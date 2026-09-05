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
  align?: 'left' | 'right';
}

export function ColourMenu({
  value,
  values,
  onChange,
  palette = 'ink',
  families: given,
  swatchFor = hexSwatch,
  align = 'left',
}: MenuProps) {
  const fieldLabel = useContext(FieldLabelContext);
  const [open, setOpen] = useState(false);
  const ref = useDismiss(open, () => setOpen(false));
  const base: Family[] = given ?? (palette === 'stock' ? STOCK_FAMILIES : INK_FAMILIES);
  const families = groupValues(values, base);
  const hasRarity = values.includes('rarity');

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
        <span className={styles.triggerName}>{value === 'rarity' ? 'Rarity colour' : value}</span>
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
                  {family.values.map((v) => (
                    <button
                      key={v}
                      type="button"
                      title={v}
                      aria-label={v}
                      aria-pressed={value === v}
                      className={`${styles.swatch} ${value === v ? styles.swatchOn : ''}`}
                      style={swatchFor(v)}
                      onClick={() => pick(v)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function ChoiceMenu({ value, values, onChange, labels, align = 'left' }: MenuProps) {
  const fieldLabel = useContext(FieldLabelContext);
  const [open, setOpen] = useState(false);
  const ref = useDismiss(open, () => setOpen(false));
  const name = (v: string) => labels?.[v] ?? v;

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
            {values.map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={value === v}
                className={`${styles.choice} ${value === v ? styles.choiceOn : ''}`}
                onClick={() => {
                  onChange(v);
                  setOpen(false);
                }}
              >
                {name(v)}
              </button>
            ))}
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
          {labels?.[v] ?? v}
        </button>
      ))}
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

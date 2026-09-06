'use client';

import { BINDER_COLOUR_NAMES, binderSwatchStyle } from '@/lib/setIdentity';
import styles from './BinderColourPicker.module.css';

/** Curated binder-cover choices rendered with the cloth material. */
export default function BinderColourPicker({
  value,
  onChange,
  label = 'Binder cover',
}: {
  value: string;
  onChange: (colour: string) => void;
  label?: string;
}) {
  const current = value || 'teal';
  return (
    <div className={styles.row} role="group" aria-label={label}>
      {BINDER_COLOUR_NAMES.map((name) => (
        <button
          key={name}
          type="button"
          title={name}
          aria-label={name}
          aria-pressed={name === current}
          className={`${styles.swatch} ${name === current ? styles.on : ''}`}
          onClick={() => onChange(name)}
        >
          <span className={styles.cloth} style={binderSwatchStyle(name)} />
        </button>
      ))}
    </div>
  );
}

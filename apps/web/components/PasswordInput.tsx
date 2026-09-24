'use client';

import { useState } from 'react';
import type { InputHTMLAttributes } from 'react';
import styles from './PasswordInput.module.css';

export default function PasswordInput({
  className,
  ...rest
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  const [shown, setShown] = useState(false);
  return (
    <span className={styles.wrap}>
      <input
        {...rest}
        type={shown ? 'text' : 'password'}
        className={`${className ?? ''} ${styles.input}`}
      />
      <button
        type="button"
        className={styles.toggle}
        aria-label={shown ? 'Hide password' : 'Show password'}
        aria-pressed={shown}
        onClick={() => setShown((current) => !current)}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
          <circle cx="12" cy="12" r="3" />
          {shown ? null : <path d="m4 4 16 16" />}
        </svg>
      </button>
    </span>
  );
}

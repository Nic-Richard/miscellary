'use client';

import type { FormEvent } from 'react';
import ui from './ui.module.css';

export default function SearchField({
  value,
  onChange,
  onSubmit,
  placeholder,
  label,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: ((value: string) => void) | undefined;
  placeholder: string;
  label: string;
  className?: string | undefined;
}) {
  const field = (
    <>
      <svg viewBox="0 0 24 24" aria-hidden="true" className={ui.searchIcon}>
        <path d="M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Zm5-2 4 4" />
      </svg>
      <input
        className={ui.searchField}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={label}
      />
      {onSubmit ? (
        <button type="submit" className={`${ui.btnQuiet} ${ui.btnSmall}`} disabled={!ready(value)}>
          Search
        </button>
      ) : null}
    </>
  );

  if (!onSubmit) return <div className={`${ui.search} ${className ?? ''}`}>{field}</div>;

  return (
    <form
      role="search"
      className={`${ui.search} ${className ?? ''}`}
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        if (ready(value)) onSubmit(value.trim());
      }}
    >
      {field}
    </form>
  );
}

const ready = (value: string) => value.trim().length >= 2;

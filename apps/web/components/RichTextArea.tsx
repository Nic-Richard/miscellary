'use client';

import { useEffect, useRef, useState } from 'react';
import Description from './Description';
import styles from './RichTextArea.module.css';

export default function RichTextArea({
  id,
  className,
  rows = 4,
  value,
  label,
  onChange,
}: {
  id?: string | undefined;
  className?: string | undefined;
  rows?: number | undefined;
  value: string;
  label: string;
  onChange: (next: string) => void;
}) {
  const field = useRef<HTMLTextAreaElement | null>(null);
  const [open, setOpen] = useState(false);
  const hold = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (open) field.current?.focus();
  }, [open]);

  if (!open && value.trim())
    return (
      <div
        id={id}
        className={`${className ?? ''} ${styles.printed}`}
        role="button"
        tabIndex={0}
        aria-label={`Edit ${label}`}
        style={{ minHeight: `${rows * 1.5}em` }}
        onClick={() => setOpen(true)}
        onFocus={() => setOpen(true)}
      >
        <Description text={value} />
      </div>
    );

  return (
    <textarea
      id={id}
      ref={field}
      className={className}
      aria-label={label}
      rows={rows}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      onFocus={() => {
        if (hold.current) clearTimeout(hold.current);
        setOpen(true);
      }}
      onBlur={() => {
        hold.current = setTimeout(() => setOpen(false), 150);
      }}
    />
  );
}

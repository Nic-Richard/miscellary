'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './MarkupBar.module.css';

type Field = HTMLInputElement | HTMLTextAreaElement;

const MARKS = [
  { key: 'bold', label: 'B', mark: '**', title: 'Bold' },
  { key: 'italic', label: 'I', mark: '*', title: 'Italic' },
  { key: 'underline', label: 'U', mark: '__', title: 'Underline' },
] as const;

function edit(field: Field, next: string, from: number, to: number) {
  // React owns the value, so the edit has to go in through the native setter.
  const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(field), 'value')?.set;
  setter?.call(field, next);
  field.dispatchEvent(new Event('input', { bubbles: true }));
  field.setSelectionRange(from, to);
  field.focus();
}

function focused(): Field | null {
  const element = document.activeElement;
  if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement)) return null;
  if (element.type && element.type !== 'text' && element.type !== 'textarea') return null;
  return element;
}

function apply(field: Field, mark: string) {
  const start = field.selectionStart ?? 0;
  const end = field.selectionEnd ?? start;
  const value = field.value;
  const chosen = value.slice(start, end);
  const next = `${value.slice(0, start)}${mark}${chosen}${mark}${value.slice(end)}`;
  const caret = start + mark.length;
  edit(field, next, caret, caret + chosen.length);
}

function bulletise(field: Field) {
  const value = field.value;
  const from = value.lastIndexOf('\n', (field.selectionStart ?? 0) - 1) + 1;
  const lineEnd = value.indexOf('\n', field.selectionEnd ?? from);
  const to = lineEnd === -1 ? value.length : lineEnd;
  const lines = value.slice(from, to).split('\n');
  const on = lines.every((line) => /^\s*-\s/.test(line));
  const marked = lines
    .map((line) => (on ? line.replace(/^\s*-\s/, '') : `- ${line.trimStart()}`))
    .join('\n');
  const caret = from + marked.length;
  edit(field, value.slice(0, from) + marked + value.slice(to), caret, caret);
}

export default function MarkupBar() {
  const bar = useRef<HTMLDivElement | null>(null);
  const target = useRef<Field | null>(null);
  const [live, setLive] = useState(false);

  useEffect(() => {
    const track = () => {
      const field = focused();
      if (field) target.current = field;
      setLive(Boolean(field));
    };
    document.addEventListener('focusin', track);
    document.addEventListener('focusout', track);
    track();
    return () => {
      document.removeEventListener('focusin', track);
      document.removeEventListener('focusout', track);
    };
  }, []);

  return (
    <div className={styles.root} ref={bar}>
      {MARKS.map((entry) => (
        <button
          key={entry.key}
          type="button"
          className={`${styles.btn} ${styles[entry.key]}`}
          title={entry.title}
          aria-label={entry.title}
          disabled={!live && !target.current}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            const field = target.current;
            if (field) apply(field, entry.mark);
          }}
        >
          {entry.label}
        </button>
      ))}
      <button
        type="button"
        className={styles.btn}
        title="Bullet list"
        aria-label="Bullet list"
        disabled={!live && !target.current}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => {
          const field = target.current;
          if (field) bulletise(field);
        }}
      >
        &#8226;
      </button>
    </div>
  );
}

'use client';

import { parseDescription, parseInline } from '@miscellary/shared';
import type { TextRegionRules } from '@miscellary/shared';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ChangeEvent, CSSProperties, MouseEvent } from 'react';
import { InlineMarkdown } from './Description';
import styles from './CardPreview.module.css';

const STEPS = 7;

function paddingY(style: CSSStyleDeclaration): number {
  return parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
}

function lineHeightOf(element: HTMLElement): number {
  const style = getComputedStyle(element);
  return parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.25;
}

/* scrollWidth is measured against the padding box, so a line that spills into
   the padding still reports as fitting. Measuring the text itself against the
   content box is what leaves the gap the plate is padded for. */
function inkWidth(element: HTMLElement): number {
  const range = document.createRange();
  range.selectNodeContents(element);
  return range.getBoundingClientRect().width;
}

function contentWidth(element: HTMLElement): number {
  const style = getComputedStyle(element);
  return element.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
}

function clipHeight(element: HTMLElement): number {
  const parent = element.parentElement;
  if (!parent) return Infinity;
  const style = getComputedStyle(parent);
  if (style.overflow !== 'hidden') return Infinity;
  return parent.clientHeight - paddingY(style);
}

interface Fit {
  scale: number;
  fits: boolean;
}

function measure(element: HTMLElement, region: TextRegionRules): Fit {
  const apply = (value: number) => element.style.setProperty('--text-scale', String(value));
  apply(1);
  const single = region.lines <= 1;
  const inset = paddingY(getComputedStyle(element));
  const panel = clipHeight(element);
  const boxed = region.markup === 'block' && panel !== Infinity;
  if (!single && element instanceof HTMLTextAreaElement) {
    element.style.height = 'auto';
    element.style.height = `${boxed ? panel : region.lines * lineHeightOf(element) + inset}px`;
  }
  const box = element instanceof HTMLTextAreaElement ? element.clientHeight : Infinity;
  const budget = region.lines * lineHeightOf(element) + inset;
  const clip = single ? Infinity : Math.min(panel, box, boxed ? budget : Infinity);
  const fits = () => {
    if (single) {
      // A field holds its value out of reach of a Range, so it keeps the
      // box-level test; a printed region is measured by its own text.
      const field = element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement;
      if (field) return element.scrollWidth <= element.clientWidth;
      return inkWidth(element) <= contentWidth(element);
    }
    if (element.scrollHeight > clip + 1) return false;
    if (boxed) return true;
    return Math.round((element.scrollHeight - inset) / lineHeightOf(element)) <= region.lines;
  };
  if (fits()) return { scale: 1, fits: true };
  apply(region.min_scale);
  if (!fits()) return { scale: region.min_scale, fits: false };
  let low = region.min_scale;
  let high = 1;
  for (let step = 0; step < STEPS; step++) {
    const middle = (low + high) / 2;
    apply(middle);
    if (fits()) low = middle;
    else high = middle;
  }
  apply(low);
  return { scale: low, fits: fits() };
}

function trimToFit(field: Field, region: TextRegionRules, value: string, held: string): string {
  const original = field.value;
  const holds = (text: string) => {
    field.value = text;
    return measure(field, region).fits;
  };
  let low = 0;
  let high = value.length;
  if (held.length <= value.length && value.startsWith(held) && holds(held)) low = held.length;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (holds(value.slice(0, middle))) low = middle;
    else high = middle - 1;
  }
  field.value = original;
  return value.slice(0, low);
}

function useFitted<T extends HTMLElement>(
  region: TextRegionRules,
  value: string,
  onFit?: (fits: boolean) => void,
) {
  const ref = useRef<T | null>(null);
  const [scale, setScale] = useState(1);
  const fitted = useRef(onFit);
  fitted.current = onFit;
  const fit = useCallback(() => {
    if (!ref.current) return;
    const { scale: next, fits } = measure(ref.current, region);
    setScale(next);
    fitted.current?.(fits);
  }, [region]);

  const measured = useRef('');
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const against = `${value}|${getComputedStyle(element).font}|${element.clientWidth}`;
    if (against === measured.current) return;
    measured.current = against;
    fit();
  });

  useEffect(() => {
    let live = true;
    const refit = () => {
      if (!live) return;
      measured.current = '';
      fit();
    };
    void document.fonts?.ready.then(refit);
    document.fonts?.addEventListener('loadingdone', refit);
    const box = ref.current?.parentElement;
    if (!box || typeof ResizeObserver === 'undefined')
      return () => {
        live = false;
        document.fonts?.removeEventListener('loadingdone', refit);
      };
    const observer = new ResizeObserver(refit);
    observer.observe(box);
    return () => {
      live = false;
      document.fonts?.removeEventListener('loadingdone', refit);
      observer.disconnect();
    };
  }, [fit]);

  return { ref, style: { '--text-scale': scale } as CSSProperties };
}

export function PrintedCopy({
  className,
  region,
  value,
}: {
  className: string;
  region: TextRegionRules;
  value: string;
}) {
  const { ref, style } = useFitted<HTMLElement>(region, value);
  if (region.markup === 'block') {
    return (
      <div className={className} ref={ref as React.Ref<HTMLDivElement>} style={style}>
        {parseDescription(value).map((block, index) =>
          block.type === 'list' ? (
            <ul key={index}>
              {block.items.map((item, item_index) => (
                <li key={item_index}>
                  <InlineMarkdown nodes={item} />
                </li>
              ))}
            </ul>
          ) : (
            <p key={index}>
              <InlineMarkdown nodes={block.children} />
            </p>
          ),
        )}
      </div>
    );
  }
  return (
    <span className={className} ref={ref as React.Ref<HTMLSpanElement>} style={style}>
      {region.markup === 'inline' ? <InlineMarkdown nodes={parseInline(value)} /> : value}
    </span>
  );
}

type Field = HTMLInputElement | HTMLTextAreaElement;

const MARKS = [
  { key: 'bold', label: 'B', mark: '**', title: 'Bold' },
  { key: 'italic', label: 'I', mark: '*', title: 'Italic' },
  { key: 'underline', label: 'U', mark: '__', title: 'Underline' },
] as const;

function edit(field: Field, next: string, from: number, to: number) {
  const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(field), 'value')?.set;
  setter?.call(field, next);
  field.dispatchEvent(new Event('input', { bubbles: true }));
  field.setSelectionRange(from, to);
  field.focus();
}

function wrap(field: Field, mark: string) {
  const start = field.selectionStart ?? 0;
  const end = field.selectionEnd ?? start;
  const chosen = field.value.slice(start, end);
  const next = `${field.value.slice(0, start)}${mark}${chosen}${mark}${field.value.slice(end)}`;
  const caret = start + mark.length;
  edit(field, next, caret, caret + chosen.length);
}

function bullet(field: Field) {
  const value = field.value;
  const start = value.lastIndexOf('\n', (field.selectionStart ?? 0) - 1) + 1;
  const lineEnd = value.indexOf('\n', field.selectionEnd ?? start);
  const end = lineEnd === -1 ? value.length : lineEnd;
  const lines = value.slice(start, end).split('\n');
  const on = lines.every((line) => /^\s*-\s/.test(line));
  const marked = lines
    .map((line) => (on ? line.replace(/^\s*-\s/, '') : `- ${line.trimStart()}`))
    .join('\n');
  const caret = start + marked.length;
  edit(field, value.slice(0, start) + marked + value.slice(end), caret, caret);
}

export function CopyField({
  className,
  region,
  label,
  value,
  onChange,
  required,
}: {
  className: string;
  region: TextRegionRules;
  label: string;
  value: string;
  onChange: (next: string) => void;
  required?: boolean;
}) {
  const held = useRef(value);
  const { ref, style } = useFitted<HTMLInputElement & HTMLTextAreaElement>(
    region,
    value,
    (fits) => {
      if (fits) {
        held.current = value;
        return;
      }
      if (!ref.current || held.current === value) return;
      const trimmed = trimToFit(ref.current, region, value, held.current);
      held.current = trimmed;
      onChange(trimmed);
    },
  );
  const [marking, setMarking] = useState(false);
  const hold = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typed = region.markup !== 'none' && value.trim().length > 0;
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (open) ref.current?.focus();
  }, [open, ref]);
  const shared = {
    className: `${className} ${styles.copyInput}`,
    'aria-label': label,
    value,
    maxLength: region.max_length,
    placeholder: label,
    required: Boolean(required),
    style,
    onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      onChange(event.target.value),
    onFocus: () => {
      if (hold.current) clearTimeout(hold.current);
      setMarking(true);
    },
    onBlur: () => {
      hold.current = setTimeout(() => {
        setMarking(false);
        setOpen(false);
      }, 150);
    },
  };
  const field =
    region.lines > 1 ? (
      <textarea {...shared} ref={ref} rows={region.lines} />
    ) : (
      <input {...shared} ref={ref} />
    );
  if (region.markup === 'none') return field;
  if (typed && !open)
    return (
      <span
        className={`${styles.copyWrap} ${styles.copyPrinted}`}
        role="button"
        tabIndex={0}
        aria-label={`Edit ${label}`}
        onClick={() => setOpen(true)}
        onFocus={() => setOpen(true)}
      >
        <PrintedCopy className={className} region={region} value={value} />
      </span>
    );
  const press = (event: MouseEvent<HTMLButtonElement>, run: (target: Field) => void) => {
    event.preventDefault();
    if (ref.current) run(ref.current);
  };
  return (
    <span className={styles.copyWrap}>
      {field}
      <span className={styles.markBar} data-open={marking ? '' : undefined} aria-hidden={!marking}>
        {MARKS.map((entry) => (
          <button
            key={entry.key}
            type="button"
            className={styles.markBtn}
            title={entry.title}
            aria-label={entry.title}
            tabIndex={-1}
            onMouseDown={(event) => press(event, (target) => wrap(target, entry.mark))}
          >
            {entry.label}
          </button>
        ))}
        {region.markup === 'block' ? (
          <button
            type="button"
            className={styles.markBtn}
            title="Bullet list"
            aria-label="Bullet list"
            tabIndex={-1}
            onMouseDown={(event) => press(event, bullet)}
          >
            &#8226;
          </button>
        ) : null}
      </span>
    </span>
  );
}

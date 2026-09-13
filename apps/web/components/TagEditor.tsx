'use client';

import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import type { Tag, TagSummary } from '@miscellary/shared';
import { TAG_LABEL_MAX } from '@miscellary/shared';
import { listTags } from '@/lib/sets';
import styles from './TagEditor.module.css';

export default function TagEditor({
  tags,
  max,
  note,
  onSave,
}: {
  tags: Tag[];
  max: number;
  note?: string;
  onSave: (labels: string[]) => Promise<Tag[]>;
}) {
  const [current, setCurrent] = useState<Tag[]>(tags);
  const [draft, setDraft] = useState('');
  const [suggestions, setSuggestions] = useState<TagSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  // Enter and the blur that follows it can both reach `add` before `busy` has
  // re-rendered, and two writes at once would replace the same list twice.
  const saving = useRef(false);

  useEffect(() => setCurrent(tags), [tags]);

  useEffect(() => {
    const term = draft.trim();
    if (term.length < 2) {
      setSuggestions([]);
      return;
    }
    // Let typing settle before asking, and drop a reply the next keystroke outran.
    let live = true;
    const timer = setTimeout(() => {
      listTags(term)
        .then((found) => live && setSuggestions(found))
        .catch(() => live && setSuggestions([]));
    }, 200);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [draft]);

  async function commit(labels: string[]) {
    if (saving.current) return;
    saving.current = true;
    setBusy(true);
    setError(null);
    try {
      setCurrent(await onSave(labels));
      setDraft('');
      setSuggestions([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save those tags.');
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }

  function add(label: string) {
    const text = label.trim();
    if (!text || saving.current || current.length >= max) return;
    if (current.some((t) => t.label.toLowerCase() === text.toLowerCase())) {
      setDraft('');
      return;
    }
    void commit([...current.map((t) => t.label), text]);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      add(draft);
    } else if (e.key === 'Backspace' && !draft && current.length) {
      e.preventDefault();
      void commit(current.slice(0, -1).map((t) => t.label));
    }
  }

  const full = current.length >= max;
  const unused = suggestions.filter((s) => !current.some((t) => t.slug === s.slug));

  return (
    <div className={styles.root}>
      <div className={styles.box} onClick={() => input.current?.focus()}>
        {current.map((tag) => (
          <span key={tag.slug} className={styles.tag}>
            {tag.label}
            <button
              type="button"
              className={styles.remove}
              disabled={busy}
              aria-label={`Remove ${tag.label}`}
              onClick={() =>
                void commit(current.filter((t) => t.slug !== tag.slug).map((t) => t.label))
              }
            >
              ×
            </button>
          </span>
        ))}
        {full ? null : (
          <input
            ref={input}
            className={styles.input}
            value={draft}
            maxLength={TAG_LABEL_MAX}
            disabled={busy}
            placeholder={current.length ? 'Add another' : 'beetles, macro, garden…'}
            aria-label="Add a tag"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            onBlur={() => add(draft)}
          />
        )}
      </div>

      {unused.length ? (
        <ul className={styles.suggestions}>
          {unused.slice(0, 6).map((s) => (
            <li key={s.slug}>
              <button type="button" className={styles.suggestion} onClick={() => add(s.label)}>
                {s.label}
                <small>{s.set_count}</small>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <p className={styles.note}>
        {error ?? note ?? `Up to ${max}. Tags are how people find this by subject.`}
      </p>
    </div>
  );
}

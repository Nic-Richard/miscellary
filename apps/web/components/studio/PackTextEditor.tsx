'use client';

import { useState } from 'react';
import { ChoiceMenu, ColourMenu, Field, Slider } from '../controls';
import { FONT_KEYS, FONT_LABELS, fontStack } from '@/lib/fonts';
import {
  EMBLEM_TEXT_NAMES,
  PACK_TEXT_MAX_LAYERS,
  PACK_TEXT_MAX_LENGTH,
  TEXT_OFFSET_MAX,
  TEXT_OFFSET_MIN,
  TEXT_ROTATE_MAX,
  TEXT_ROTATE_MIN,
  TEXT_SIZE_MAX,
  TEXT_SIZE_MIN,
  TEXT_TRACKING_MAX,
  TEXT_TRACKING_MIN,
  TEXT_LAYER_DEFAULT,
} from '@/lib/setIdentity';
import type { PackTextLayer } from '@/lib/setIdentity';
import ui from '../ui.module.css';
import styles from './PackTextEditor.module.css';

interface PackTextEditorProps {
  layers: PackTextLayer[];
  onDraft: (layers: PackTextLayer[]) => void;
  onSave: (layers: PackTextLayer[]) => void;
}

export default function PackTextEditor({ layers, onDraft, onSave }: PackTextEditorProps) {
  const [open, setOpen] = useState<number | null>(layers.length ? 0 : null);

  function change(i: number, patch: Partial<PackTextLayer>, save: boolean) {
    const next = layers.map((l, at) => (at === i ? { ...l, ...patch } : l));
    if (save) onSave(next);
    else onDraft(next);
  }

  function add() {
    const next = [...layers, { ...TEXT_LAYER_DEFAULT, text: 'New line' }];
    setOpen(next.length - 1);
    onSave(next);
  }

  function remove(i: number) {
    setOpen(null);
    onSave(layers.filter((_, at) => at !== i));
  }

  return (
    <div className={styles.root}>
      {layers.length === 0 ? (
        <p className={styles.empty}>
          Nothing yet. Add a line to print your own words anywhere on the pack.
        </p>
      ) : null}

      {layers.map((layer, i) => (
        <div key={i} className={`${styles.layer} ${layer.hidden ? styles.layerOff : ''}`}>
          <div className={styles.head}>
            <button
              type="button"
              className={styles.eye}
              aria-pressed={!layer.hidden}
              aria-label={layer.hidden ? `Show line ${i + 1}` : `Hide line ${i + 1}`}
              title={layer.hidden ? 'Show' : 'Hide'}
              onClick={() => change(i, { hidden: !layer.hidden }, true)}
            >
              {layer.hidden ? (
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M3 3l18 18" />
                  <path d="M10.6 5.2A9.6 9.6 0 0 1 12 5c5 0 9 4.5 9 7a11 11 0 0 1-2.4 3.4M6.2 7.3C3.9 8.8 3 10.8 3 12c0 2.5 4 7 9 7a9.3 9.3 0 0 0 4-.9" />
                  <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M3 12c0-2.5 4-7 9-7s9 4.5 9 7-4 7-9 7-9-4.5-9-7Z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
            <button
              type="button"
              className={styles.name}
              aria-expanded={open === i}
              onClick={() => setOpen(open === i ? null : i)}
              style={{ fontFamily: fontStack(layer.font) }}
            >
              {layer.text || `Line ${i + 1}`}
            </button>
            <button
              type="button"
              className={styles.remove}
              aria-label={`Remove line ${i + 1}`}
              onClick={() => remove(i)}
            >
              Remove
            </button>
          </div>

          {open === i ? (
            <div className={styles.body}>
              <Field label="Text">
                <input
                  className={ui.input}
                  aria-label="Text"
                  value={layer.text}
                  maxLength={PACK_TEXT_MAX_LENGTH}
                  onChange={(e) => change(i, { text: e.target.value }, false)}
                  onBlur={(e) => change(i, { text: e.target.value }, true)}
                />
              </Field>
              <Field label="Font">
                <ChoiceMenu
                  value={layer.font}
                  values={[...FONT_KEYS]}
                  labels={FONT_LABELS}
                  onChange={(v) => change(i, { font: v }, true)}
                />
              </Field>
              <Field label="Colour">
                <ColourMenu
                  value={layer.colour}
                  values={EMBLEM_TEXT_NAMES}
                  onChange={(v) => change(i, { colour: v }, true)}
                />
              </Field>
              <Field label="Size">
                <Slider
                  value={layer.size}
                  min={TEXT_SIZE_MIN}
                  max={TEXT_SIZE_MAX}
                  onChange={(v) => change(i, { size: v }, false)}
                  onCommit={(v) => change(i, { size: v }, true)}
                />
              </Field>
              <Field label="Across">
                <Slider
                  value={layer.x}
                  min={TEXT_OFFSET_MIN}
                  max={TEXT_OFFSET_MAX}
                  onChange={(v) => change(i, { x: v }, false)}
                  onCommit={(v) => change(i, { x: v }, true)}
                />
              </Field>
              <Field label="Down">
                <Slider
                  value={layer.y}
                  min={TEXT_OFFSET_MIN}
                  max={TEXT_OFFSET_MAX}
                  onChange={(v) => change(i, { y: v }, false)}
                  onCommit={(v) => change(i, { y: v }, true)}
                />
              </Field>
              <Field label="Rotate">
                <Slider
                  value={layer.rotate}
                  min={TEXT_ROTATE_MIN}
                  max={TEXT_ROTATE_MAX}
                  suffix="°"
                  onChange={(v) => change(i, { rotate: v }, false)}
                  onCommit={(v) => change(i, { rotate: v }, true)}
                />
              </Field>
              <Field label="Spacing">
                <Slider
                  value={layer.tracking}
                  min={TEXT_TRACKING_MIN}
                  max={TEXT_TRACKING_MAX}
                  onChange={(v) => change(i, { tracking: v }, false)}
                  onCommit={(v) => change(i, { tracking: v }, true)}
                />
              </Field>
            </div>
          ) : null}
        </div>
      ))}

      <button
        type="button"
        className={ui.btnOutline}
        onClick={add}
        disabled={layers.length >= PACK_TEXT_MAX_LAYERS}
      >
        Add a line
      </button>
    </div>
  );
}

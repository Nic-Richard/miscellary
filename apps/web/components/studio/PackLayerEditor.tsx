'use client';

import { useState } from 'react';
import type { ImageRef } from '@miscellary/shared';
import ArtPicker from '../ArtPicker';
import { Field, Slider } from '../controls';
import {
  ART_OFFSET_MAX,
  ART_OFFSET_MIN,
  ART_OPACITY_MAX,
  ART_OPACITY_MIN,
  ART_ROTATE_MAX,
  ART_ROTATE_MIN,
  ART_SCALE_MAX,
  ART_SCALE_MIN,
  LAYER_DEFAULT,
  PACK_LAYER_MAX,
  SCALE_MAX,
  SCALE_MIN,
} from '@/lib/setIdentity';
import type { PackLayer } from '@/lib/setIdentity';
import ui from '../ui.module.css';
import styles from './PackTextEditor.module.css';

interface PackLayerEditorProps {
  layers: PackLayer[];
  onDraft: (layers: PackLayer[]) => void;
  onSave: (layers: PackLayer[]) => void;
}

// Layer order matches paint order, bottom first.
export default function PackLayerEditor({ layers, onDraft, onSave }: PackLayerEditorProps) {
  const [open, setOpen] = useState<number | null>(layers.length ? 0 : null);
  const [adding, setAdding] = useState(false);

  function change(i: number, patch: Partial<PackLayer>, save: boolean) {
    const next = layers.map((l, at) => (at === i ? { ...l, ...patch } : l));
    if (save) onSave(next);
    else onDraft(next);
  }

  function addImage(image: ImageRef | null) {
    if (!image) return;
    const next: PackLayer[] = [
      ...layers,
      {
        ...LAYER_DEFAULT,
        image_id: image.id,
        url: image.url,
        width: image.width,
        height: image.height,
      },
    ];
    setAdding(false);
    setOpen(next.length - 1);
    onSave(next);
  }

  function addEmblem() {
    const next: PackLayer[] = [
      ...layers,
      { ...LAYER_DEFAULT, kind: 'emblem', image_id: '', url: '', width: 0, height: 0 },
    ];
    setOpen(next.length - 1);
    onSave(next);
  }

  function replace(i: number, image: ImageRef | null) {
    if (!image) return;
    change(
      i,
      { image_id: image.id, url: image.url, width: image.width, height: image.height },
      true,
    );
  }

  function remove(i: number) {
    setOpen(null);
    onSave(layers.filter((_, at) => at !== i));
  }

  function move(i: number, by: number) {
    const to = i + by;
    if (to < 0 || to >= layers.length) return;
    const next = [...layers];
    const [moved] = next.splice(i, 1);
    next.splice(to, 0, moved!);
    setOpen(to);
    onSave(next);
  }

  const hasEmblem = layers.some((l) => l.kind === 'emblem');

  return (
    <div className={styles.root}>
      {layers.length === 0 && !adding ? (
        <p className={styles.empty}>
          Nothing on the front yet. Add your own artwork, or put the set&rsquo;s badge back.
        </p>
      ) : null}

      {layers.map((layer, i) => {
        const emblem = layer.kind === 'emblem';
        return (
          <div key={i} className={`${styles.layer} ${layer.hidden ? styles.layerOff : ''}`}>
            <div className={styles.head}>
              <button
                type="button"
                className={styles.eye}
                aria-pressed={!layer.hidden}
                aria-label={layer.hidden ? `Show layer ${i + 1}` : `Hide layer ${i + 1}`}
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

              <span className={styles.swatch}>
                {emblem ? (
                  <span className={styles.swatchMark}>◆</span>
                ) : (
                  <img src={layer.url} alt="" />
                )}
              </span>

              <button
                type="button"
                className={styles.name}
                aria-expanded={open === i}
                onClick={() => setOpen(open === i ? null : i)}
              >
                {emblem ? 'Set badge' : `Image ${i + 1}`}
              </button>

              <button
                type="button"
                className={styles.step}
                aria-label={`Move layer ${i + 1} down the stack`}
                disabled={i === 0}
                onClick={() => move(i, -1)}
              >
                ↓
              </button>
              <button
                type="button"
                className={styles.step}
                aria-label={`Move layer ${i + 1} up the stack`}
                disabled={i === layers.length - 1}
                onClick={() => move(i, 1)}
              >
                ↑
              </button>
              <button
                type="button"
                className={styles.remove}
                aria-label={`Remove layer ${i + 1}`}
                onClick={() => remove(i)}
              >
                Remove
              </button>
            </div>

            {open === i ? (
              <div className={styles.body}>
                {emblem ? (
                  <p className={styles.empty}>How it is drawn is set in Badge, below.</p>
                ) : (
                  <Field label="Picture">
                    <ArtPicker value={null} onChange={(image) => replace(i, image)} />
                  </Field>
                )}
                <Field label="Size">
                  <Slider
                    value={layer.scale}
                    min={emblem ? SCALE_MIN : ART_SCALE_MIN}
                    max={emblem ? SCALE_MAX : ART_SCALE_MAX}
                    suffix="%"
                    onChange={(v) => change(i, { scale: v }, false)}
                    onCommit={(v) => change(i, { scale: v }, true)}
                  />
                </Field>
                <Field label="Across">
                  <Slider
                    value={layer.x}
                    min={ART_OFFSET_MIN}
                    max={ART_OFFSET_MAX}
                    onChange={(v) => change(i, { x: v }, false)}
                    onCommit={(v) => change(i, { x: v }, true)}
                  />
                </Field>
                <Field label="Down">
                  <Slider
                    value={layer.y}
                    min={ART_OFFSET_MIN}
                    max={ART_OFFSET_MAX}
                    onChange={(v) => change(i, { y: v }, false)}
                    onCommit={(v) => change(i, { y: v }, true)}
                  />
                </Field>
                <Field label="Rotate">
                  <Slider
                    value={layer.rotate}
                    min={ART_ROTATE_MIN}
                    max={ART_ROTATE_MAX}
                    suffix="°"
                    onChange={(v) => change(i, { rotate: v }, false)}
                    onCommit={(v) => change(i, { rotate: v }, true)}
                  />
                </Field>
                {!emblem ? (
                  <Field label="Flip">
                    <div className={styles.flips}>
                      <button
                        type="button"
                        aria-pressed={layer.flip_x}
                        className={`${styles.flip} ${layer.flip_x ? styles.flipOn : ''}`}
                        onClick={() => change(i, { flip_x: !layer.flip_x }, true)}
                      >
                        Horizontal
                      </button>
                      <button
                        type="button"
                        aria-pressed={layer.flip_y}
                        className={`${styles.flip} ${layer.flip_y ? styles.flipOn : ''}`}
                        onClick={() => change(i, { flip_y: !layer.flip_y }, true)}
                      >
                        Vertical
                      </button>
                    </div>
                  </Field>
                ) : null}
                <Field label="Opacity">
                  <Slider
                    value={layer.opacity}
                    min={ART_OPACITY_MIN}
                    max={ART_OPACITY_MAX}
                    suffix="%"
                    onChange={(v) => change(i, { opacity: v }, false)}
                    onCommit={(v) => change(i, { opacity: v }, true)}
                  />
                </Field>
              </div>
            ) : null}
          </div>
        );
      })}

      {adding ? (
        <div className={styles.layer}>
          <div className={styles.body}>
            <Field label="Picture">
              <ArtPicker value={null} onChange={addImage} />
            </Field>
            <button type="button" className={ui.btnQuiet} onClick={() => setAdding(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className={styles.adders}>
          <button
            type="button"
            className={ui.btnOutline}
            onClick={() => setAdding(true)}
            disabled={layers.length >= PACK_LAYER_MAX}
          >
            Add an image
          </button>
          {!hasEmblem ? (
            <button
              type="button"
              className={ui.btnOutline}
              onClick={addEmblem}
              disabled={layers.length >= PACK_LAYER_MAX}
            >
              Add the badge
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}

'use client';

import { useState } from 'react';
import type { ImageRef } from '@miscellary/shared';
import { artToBlob, uploadImage } from '@/lib/upload';
import styles from './ArtPicker.module.css';

interface ArtPickerProps {
  value: ImageRef | null;
  onChange: (image: ImageRef | null) => void;
}

// Pack art preserves its aspect ratio and alpha instead of using the crop flow.
export default function ArtPicker({ value, onChange }: ArtPickerProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pick(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      onChange(await uploadImage(await artToBlob(file), 'pack'));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.root}>
      <label className={styles.drop}>
        {value ? (
          <span className={styles.mesh}>
            <img src={value.url} alt="" className={styles.thumb} />
          </span>
        ) : (
          <span className={styles.empty}>
            {busy ? 'Uploading…' : 'Choose a PNG'}
            <small>Transparency is kept</small>
          </span>
        )}
        <input
          type="file"
          accept="image/png,image/webp"
          onChange={(e) => void pick(e.target.files?.[0])}
          disabled={busy}
          hidden
        />
      </label>
      {value ? (
        <div className={styles.actions}>
          <label className={styles.link}>
            Replace
            <input
              type="file"
              accept="image/png,image/webp"
              onChange={(e) => void pick(e.target.files?.[0])}
              disabled={busy}
              hidden
            />
          </label>
          <button type="button" className={styles.link} onClick={() => onChange(null)}>
            Remove
          </button>
        </div>
      ) : null}
      {error ? <p className={styles.error}>{error}</p> : null}
    </div>
  );
}

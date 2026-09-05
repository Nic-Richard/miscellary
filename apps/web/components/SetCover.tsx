'use client';

import { useState } from 'react';
import type { ImageRef } from '@miscellary/shared';
import ImagePicker from './ImagePicker';
import styles from './SetCover.module.css';

interface SetCoverProps {
  url: string | null;
  fallback?: string | null;
  title: string;
  onChange?: (image: ImageRef | null) => void;
}

export default function SetCover({ url, fallback, title, onChange }: SetCoverProps) {
  const [editing, setEditing] = useState(false);
  const editable = Boolean(onChange);
  const shown = url ?? fallback ?? null;

  if (editing && onChange) {
    return (
      <div className={styles.editor}>
        <ImagePicker
          kind="cover"
          aspect={5 / 7}
          value={null}
          onChange={(image) => {
            onChange(image);
            setEditing(false);
          }}
        />
        <button type="button" className={styles.link} onClick={() => setEditing(false)}>
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className={styles.root}>
      <div className={styles.sleeve} aria-hidden={!editable}>
        <div className={styles.card}>
          {shown ? <img src={shown} alt="" /> : <span>{title[0]}</span>}
        </div>
      </div>
      {editable ? (
        <div className={styles.actions}>
          <button type="button" className={styles.link} onClick={() => setEditing(true)}>
            {url ? 'Change cover' : 'Add a cover'}
          </button>
          {url ? (
            <button type="button" className={styles.link} onClick={() => onChange?.(null)}>
              Remove
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

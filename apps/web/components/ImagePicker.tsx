'use client';

import { useCallback, useState } from 'react';
import Cropper from 'react-easy-crop';
import type { Area } from 'react-easy-crop';
import type { ImageKind, ImageRef } from '@miscellary/shared';
import { cropToBlob, uploadImage } from '@/lib/upload';
import styles from './ImagePicker.module.css';

interface ImagePickerProps {
  kind: ImageKind;
  aspect: number;
  value: ImageRef | null;
  onChange: (image: ImageRef) => void;
}

export default function ImagePicker({ kind, aspect, value, onChange }: ImagePickerProps) {
  const [file, setFile] = useState<File | null>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<Area | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function pick(f: File | undefined) {
    if (!f) return;
    if (src) URL.revokeObjectURL(src);
    setFile(f);
    setSrc(URL.createObjectURL(f));
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setError(null);
  }

  const onCropComplete = useCallback((_: Area, pixels: Area) => setArea(pixels), []);

  async function save() {
    if (!file || !area) return;
    setBusy(true);
    setError(null);
    try {
      const blob = await cropToBlob(file, area);
      onChange(await uploadImage(blob, kind));
      if (src) URL.revokeObjectURL(src);
      setSrc(null);
      setFile(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.root}>
      {src ? (
        <>
          <div className={styles.cropper}>
            <Cropper
              image={src}
              crop={crop}
              zoom={zoom}
              aspect={aspect}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
            />
          </div>
          <div className={styles.controls}>
            <input
              type="range"
              min={1}
              max={3}
              step={0.05}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
            />
            <button
              type="button"
              className={styles.primary}
              onClick={() => void save()}
              disabled={busy}
            >
              {busy ? 'Uploading…' : 'Use this crop'}
            </button>
            <button
              type="button"
              className={styles.secondary}
              onClick={() => setSrc(null)}
              disabled={busy}
            >
              Cancel
            </button>
          </div>
        </>
      ) : (
        <label className={styles.drop}>
          {value ? (
            <img src={value.url} alt="" className={styles.thumb} />
          ) : (
            <span>Choose a photo</span>
          )}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => pick(e.target.files?.[0])}
            hidden
          />
          {value ? <span className={styles.change}>Change photo</span> : null}
        </label>
      )}
      {error ? <p className={styles.error}>{error}</p> : null}
    </div>
  );
}

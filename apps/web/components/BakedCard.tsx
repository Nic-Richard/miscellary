import { resolveCardMaterial, resolveCardTokens } from '@miscellary/shared';
import { SPOT_PATTERNS } from '@miscellary/shared';
import type { CardRenderAssets, CardRenderImage, Rarity, TemplateConfig } from '@miscellary/shared';
import { useEffect, useState } from 'react';
import type { CSSProperties, SyntheticEvent } from 'react';
import styles from './BakedCard.module.css';

function stops(values: { color: string; at?: number }[], unit = '%'): string {
  return values
    .map((stop, index) => {
      const at = stop.at ?? (index / Math.max(1, values.length - 1)) * 100;
      return `${stop.color} ${at}${unit}`;
    })
    .join(', ');
}

export function FlatCard({
  image,
  title,
  rarity,
  templateKey,
  templateConfig,
}: {
  image: CardRenderImage;
  title: string;
  rarity: Rarity;
  templateKey: string;
  templateConfig: TemplateConfig;
}) {
  const tokens = resolveCardTokens(templateKey, templateConfig, rarity);
  const vars = {
    '--baked-corner-x': `${tokens.corner}%`,
    '--baked-corner-y': `${tokens.corner / 1.4}%`,
  } as CSSProperties;
  return (
    <div className={`${styles.card} ${styles.small}`} style={vars} role="img" aria-label={title}>
      <img
        src={image.url}
        alt=""
        width={image.width}
        height={image.height}
        loading="lazy"
        draggable={false}
      />
    </div>
  );
}

export default function BakedCard({
  render,
  title,
  rarity,
  templateKey,
  templateConfig,
  size,
  lit,
}: {
  render: CardRenderAssets;
  title: string;
  rarity: Rarity;
  templateKey: string;
  templateConfig: TemplateConfig;
  size: 'small' | 'large';
  lit?: boolean | undefined;
}) {
  const image = size === 'small' ? render.thumbnail : render.front;
  const material = resolveCardMaterial(templateKey, templateConfig, rarity);
  const tokens = resolveCardTokens(templateKey, templateConfig, rarity);
  const full = material.spot?.area === 'full';
  const mask = size === 'small' ? render.mask_thumbnail : render.mask;
  const spot = material.spot;
  const layers = spot?.layers;
  const worked = spot ? SPOT_PATTERNS[spot.pattern] : null;
  const preview = size === 'large' ? (render.flat_thumbnail ?? render.thumbnail) : null;
  const imageUrl = image?.url ?? '';
  const maskUrl = mask?.url ?? null;
  const hasSpot = Boolean(spot);
  const [loadedFront, setLoadedFront] = useState<string | null>(null);
  const [loadedMask, setLoadedMask] = useState<string | null>(null);
  const detailed =
    size === 'small' ||
    (loadedFront === imageUrl && (!hasSpot || !maskUrl || loadedMask === maskUrl));

  useEffect(() => {
    if (size !== 'large' || !hasSpot || !maskUrl) return;
    let live = true;
    const preload = new window.Image();
    const ready = () => {
      if (live) setLoadedMask(maskUrl);
    };
    preload.src = maskUrl;
    if (preload.decode)
      void preload
        .decode()
        .then(ready)
        .catch(() => undefined);
    else preload.addEventListener('load', ready, { once: true });
    return () => {
      live = false;
    };
  }, [hasSpot, maskUrl, size]);

  function frontLoaded(event: SyntheticEvent<HTMLImageElement>) {
    const loaded = event.currentTarget;
    const ready = () => setLoadedFront(imageUrl);
    if (loaded.decode) void loaded.decode().then(ready).catch(ready);
    else ready();
  }

  if (!image) return null;
  const grain =
    layers &&
    (worked?.grain
      ? worked.grain
      : `repeating-linear-gradient(${layers.field.stripes.angle}deg, ${stops(layers.field.stripes.stops, 'cqw')})`);
  const vars = {
    '--baked-corner-x': `${tokens.corner}%`,
    '--baked-corner-y': `${tokens.corner / 1.4}%`,
    '--baked-coat': `linear-gradient(var(--lit-angle, ${material.coat.angle}deg), ${stops(material.coat.stops)})`,
    '--baked-coat-blend': material.coatBlend,
    '--baked-sheen': material.sheen,
    '--baked-mask': mask ? `url('${mask.url}')` : 'none',
    '--baked-field': layers
      ? `${grain}, linear-gradient(var(--lit-angle, ${layers.field.sheet.angle}deg), ${stops(layers.field.sheet.stops)})`
      : 'none',
    '--baked-grain-size': worked?.size ? `${worked.size}, auto` : 'auto, auto',
    '--baked-field-opacity': layers
      ? layers.field.opacity * (full ? 0.5 : 1) * (worked?.wash ? 0.5 : 1)
      : 0,
    '--baked-field-blend': layers?.field.blend ?? 'normal',
    '--baked-band': worked?.wash
      ? worked.wash
      : layers
        ? `linear-gradient(var(--lit-angle, ${layers.band.gradient.angle}deg), ${stops(layers.band.gradient.stops)})`
        : 'none',
    '--baked-band-opacity': layers ? layers.band.opacity * (full ? 0.5 : 1) : 0,
    '--baked-band-blend': worked?.wash ? 'soft-light' : (layers?.band.blend ?? 'normal'),
    '--baked-band-size': worked?.wash
      ? '150%'
      : `${(full ? 5.6 : (layers?.band.scale ?? 1)) * 100}%`,
  } as CSSProperties;

  return (
    <div
      className={`${styles.card} ${size === 'small' ? styles.small : styles.large}`}
      data-lit={lit ? '' : undefined}
      style={vars}
      role="img"
      aria-label={title}
    >
      {preview && preview.url !== image.url ? (
        <img
          className={`${styles.preview} ${detailed ? styles.previewHidden : ''}`}
          src={preview.url}
          alt=""
          draggable={false}
        />
      ) : null}
      <img
        className={size === 'large' ? `${styles.detail} ${detailed ? styles.detailReady : ''}` : ''}
        src={image.url}
        alt=""
        draggable={false}
        decoding="async"
        onLoad={size === 'large' ? frontLoaded : undefined}
      />
      {detailed ? <i className={styles.finish} aria-hidden="true" /> : null}
      {detailed && spot && mask ? (
        <>
          <i className={styles.spotField} aria-hidden="true" />
          <i className={styles.spotBand} aria-hidden="true" />
        </>
      ) : null}
    </div>
  );
}

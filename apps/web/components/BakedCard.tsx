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
  const needsMask = Boolean(spot && !full);
  const layers = spot?.layers;
  const worked = spot ? SPOT_PATTERNS[spot.pattern] : null;
  const preview = render.flat_thumbnail ?? render.thumbnail;
  const imageUrl = image?.url ?? '';
  const maskUrl = needsMask ? (mask?.url ?? null) : null;
  const [loadedFront, setLoadedFront] = useState<string | null>(null);
  const [loadedMask, setLoadedMask] = useState<string | null>(null);
  const detailed =
    loadedFront === imageUrl && (!needsMask || Boolean(maskUrl && loadedMask === maskUrl));

  useEffect(() => {
    if (!needsMask || !maskUrl) return;
    let live = true;
    const controller = new AbortController();
    // Chrome fetches a CSS mask image with CORS, and a no-CORS response cached
    // for the same URL leaves the masked layers transparent.
    const preload = async () => {
      const image = new window.Image();
      image.crossOrigin = 'anonymous';
      if (image.decode) {
        image.src = maskUrl;
        await image.decode();
        return;
      }
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error('Could not decode card mask'));
        image.src = maskUrl;
      });
    };
    const load = async () => {
      try {
        await preload();
      } catch {
        // Replace a cached no-CORS response.
        await fetch(maskUrl, { cache: 'reload', signal: controller.signal });
        await preload();
      }
      if (live) setLoadedMask(maskUrl);
    };
    // Keep the composited thumbnail when a partial-foil mask cannot load.
    void load().catch(() => {});
    return () => {
      live = false;
      controller.abort();
    };
  }, [needsMask, maskUrl]);

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
    '--baked-mask': maskUrl ? `url('${maskUrl}')` : 'none',
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
        className={`${styles.detail} ${detailed ? styles.detailReady : ''}`}
        src={image.url}
        alt=""
        draggable={false}
        decoding="async"
        onLoad={frontLoaded}
      />
      {detailed ? <i className={styles.finish} aria-hidden="true" /> : null}
      {detailed && spot && (!needsMask || mask) ? (
        <>
          <i className={styles.spotField} aria-hidden="true" />
          <i className={styles.spotBand} aria-hidden="true" />
        </>
      ) : null}
    </div>
  );
}

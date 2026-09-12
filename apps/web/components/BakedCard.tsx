import { resolveCardMaterial, resolveCardTokens } from '@miscellary/shared';
import { SPOT_PATTERNS } from '@miscellary/shared';
import type { CardRenderAssets, CardRenderImage, Rarity, TemplateConfig } from '@miscellary/shared';
import type { CSSProperties } from 'react';
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
  if (!image) return null;
  const material = resolveCardMaterial(templateKey, templateConfig, rarity);
  const tokens = resolveCardTokens(templateKey, templateConfig, rarity);
  const full = material.spot?.area === 'full';
  const mask = size === 'small' ? render.mask_thumbnail : render.mask;
  const spot = material.spot;
  const layers = spot?.layers;
  const worked = spot ? SPOT_PATTERNS[spot.pattern] : null;
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
      <img src={image.url} alt="" draggable={false} />
      <i className={styles.finish} aria-hidden="true" />
      {spot && mask ? (
        <>
          <i className={styles.spotField} aria-hidden="true" />
          <i className={styles.spotBand} aria-hidden="true" />
        </>
      ) : null}
    </div>
  );
}

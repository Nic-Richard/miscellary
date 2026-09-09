import { resolveCardMaterial, resolveCardTokens } from '@miscellary/shared';
import type { CardRenderAssets, Rarity, TemplateConfig } from '@miscellary/shared';
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
  const mask = size === 'small' ? render.mask_thumbnail : render.mask;
  const chase = material.chase;
  const vars = {
    '--baked-corner-x': `${tokens.corner}%`,
    '--baked-corner-y': `${tokens.corner / 1.4}%`,
    '--baked-coat': `linear-gradient(var(--lit-angle, ${material.coat.angle}deg), ${stops(material.coat.stops)})`,
    '--baked-sheen': material.sheen,
    '--baked-mask': mask ? `url('${mask.url}')` : 'none',
    '--baked-field': chase
      ? `repeating-linear-gradient(${chase.field.stripes.angle}deg, ${stops(chase.field.stripes.stops, 'cqw')}), linear-gradient(var(--lit-angle, ${chase.field.sheet.angle}deg), ${stops(chase.field.sheet.stops)})`
      : 'none',
    '--baked-field-opacity': chase?.field.opacity ?? 0,
    '--baked-field-blend': chase?.field.blend ?? 'normal',
    '--baked-band': chase
      ? `linear-gradient(var(--lit-angle, ${chase.band.gradient.angle}deg), ${stops(chase.band.gradient.stops)})`
      : 'none',
    '--baked-band-opacity': chase?.band.opacity ?? 0,
    '--baked-band-blend': chase?.band.blend ?? 'normal',
    '--baked-band-size': `${(chase?.band.scale ?? 1) * 100}%`,
  } as CSSProperties;

  return (
    <div
      className={`${styles.card} ${size === 'small' ? styles.small : styles.large}`}
      data-lit={lit ? '' : undefined}
      style={vars}
      role="img"
      aria-label={title}
    >
      <img src={image.url} alt="" />
      <i className={styles.finish} aria-hidden="true" />
      {chase && mask ? (
        <>
          <i className={styles.chaseField} aria-hidden="true" />
          <i className={styles.chaseBand} aria-hidden="true" />
        </>
      ) : null}
    </div>
  );
}

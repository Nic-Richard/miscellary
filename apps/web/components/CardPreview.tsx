import { captionFrom, paintToCss, resolveCardTokens, restOf } from '@miscellary/shared';
import type { CardRenderAssets, Rarity, TemplateConfig } from '@miscellary/shared';
import type { CSSProperties } from 'react';
import Description from './Description';
import BakedCard from './BakedCard';
import SetMark from './SetMark';
import { resolveMark } from '@/lib/setIdentity';
import styles from './CardPreview.module.css';

export interface CardPreviewProps {
  title: string;
  rarity: Rarity;
  description: string;
  imageUrl: string | null;
  templateKey: string;
  templateConfig: TemplateConfig;
  size?: 'small' | 'large';
  number?: number;
  caption?: string;
  mark?: string | undefined;
  lit?: boolean | undefined;
  render?: CardRenderAssets | null | undefined;
  renderMode?: 'static' | 'mask';
}

const TEXT_TEMPLATES = new Set(['fieldnote', 'dossier']);

/* Written out rather than built from the token so the surfaces bundler can inline each file. */
const TEXTURE_URLS: Record<string, string> = {
  linen: '/materials/tex-linen.png',
  canvas: '/materials/tex-canvas.png',
  grain: '/materials/tex-grain.png',
  felt: '/materials/tex-felt.png',
  brushed: '/materials/tex-brushed.png',
};

function cardVars(templateKey: string, config: TemplateConfig, rarity: Rarity): CSSProperties {
  const t = resolveCardTokens(templateKey, config, rarity);
  const vars: Record<string, string> = {
    '--stock': t.stock,
    '--edge': paintToCss(t.edge),
    '--edge-w': `${t.edgeWidth}cqw`,
    '--corner': `${t.corner}cqw`,
    '--ink': t.ink,
    '--ink-muted': t.inkMuted,
    '--art-bg': t.artBg,
    '--ac': t.accent,
    '--bc': t.border,
    '--rc': t.rarity,
    '--core': t.core,
  };
  if (t.glow) vars['--glow'] = t.glow;
  if (t.texture) {
    const { image, size, opacity, blend } = t.texture;
    const url = image && image !== 'none' ? TEXTURE_URLS[image] : null;
    if (image === 'none') vars['--tex'] = 'none';
    else if (url) vars['--tex'] = `url('${url}')`;
    if (size !== null) vars['--tex-size'] = `${size}px`;
    if (opacity !== null) vars['--tex-opacity'] = String(opacity);
    if (blend) vars['--tex-blend'] = blend;
  }
  return vars as CSSProperties;
}

function chaseLayers(css: Record<string, string>, framed: boolean) {
  const frame = framed ? ` ${css.chaseFrame}` : '';
  return (
    <>
      <i className={`${css.chase} ${css.chaseField}${frame}`} aria-hidden="true" />
      <i className={`${css.chase} ${css.chaseBand}${frame}`} aria-hidden="true" />
    </>
  );
}

export default function CardPreview({
  title,
  rarity,
  description,
  imageUrl,
  templateKey,
  templateConfig,
  size = 'large',
  number,
  caption,
  mark,
  lit,
  render,
  renderMode,
}: CardPreviewProps) {
  const bakedImage = size === 'small' ? render?.thumbnail : render?.front;
  if (!renderMode && render && bakedImage) {
    return (
      <BakedCard
        render={render}
        title={title}
        rarity={rarity}
        templateKey={templateKey}
        templateConfig={templateConfig}
        size={size}
        lit={lit}
      />
    );
  }
  if (!renderMode && render) {
    return (
      <div
        className={`${styles.card} ${styles.pending} ${size === 'small' ? styles.small : styles.large}`}
        style={cardVars(templateKey, templateConfig, rarity)}
        role="img"
        aria-label={`${title} render pending`}
      />
    );
  }
  const data: Record<string, string> = {};
  for (const [k, v] of Object.entries(templateConfig)) data[`data-${k}`] = v;
  const shownTitle = title || 'Untitled';
  const isText = TEXT_TEMPLATES.has(templateKey);
  const line = templateKey === 'polaroid' ? shownTitle : (caption ?? captionFrom(description));
  const chase = templateConfig.treatment === 'foil' || templateConfig.treatment === 'holo';
  const coverage = templateConfig.coverage ?? 'art';
  const varnish = templateConfig.relief === 'spot';
  const body = caption === undefined ? restOf(description) : description;

  return (
    <div
      className={`${styles.card} ${styles[templateKey] ?? styles.classic} ${size === 'small' ? styles.small : styles.large}`}
      data-rarity={rarity}
      data-lit={lit ? '' : undefined}
      data-render={renderMode}
      style={cardVars(templateKey, templateConfig, rarity)}
      {...data}
    >
      <div className={styles.stock}>
        <header className={styles.head}>
          {number ? <b className={styles.num}>{String(number).padStart(3, '0')}</b> : null}
          <span className={styles.name}>{shownTitle}</span>
          <SetMark mark={resolveMark(mark)} className={styles.mark} />
        </header>
        <div className={styles.art}>
          {renderMode !== 'mask' && imageUrl ? (
            <img src={imageUrl} alt="" />
          ) : renderMode !== 'mask' ? (
            <div className={styles.placeholder}>No photo yet</div>
          ) : null}
          {varnish && renderMode !== 'mask' ? (
            <i className={styles.varnish} aria-hidden="true" />
          ) : null}
          {renderMode === 'mask' && coverage === 'art' ? (
            <i className={styles.materialMask} aria-hidden="true" />
          ) : null}
          {!renderMode && chase && coverage === 'art' ? chaseLayers(styles, false) : null}
        </div>

        {isText ? (
          <div className={styles.panel}>
            {description ? (
              <Description text={description} className={styles.panelBody} />
            ) : (
              <span className={styles.panelEmpty}>No description yet</span>
            )}
          </div>
        ) : null}

        {templateKey === 'bold' || (!isText && line) ? (
          <footer className={styles.foot}>
            {templateKey === 'bold' ? <span className={styles.bigTitle}>{shownTitle}</span> : null}
            {!isText && line ? <span className={styles.caption}>{line}</span> : null}
          </footer>
        ) : null}

        {!renderMode && chase && coverage !== 'art'
          ? chaseLayers(styles, coverage === 'frame')
          : null}
        {renderMode === 'mask' && coverage !== 'art' ? (
          <i
            className={`${styles.materialMask} ${coverage === 'frame' ? styles.materialMaskFrame : ''}`}
            aria-hidden="true"
          />
        ) : null}

        {!isText && size === 'large' && body ? (
          <Description text={body} className={styles.desc} />
        ) : null}
      </div>
    </div>
  );
}

import {
  cardTextRules,
  currentConfig,
  paintToCss,
  resolveCardSpot,
  resolveCardTokens,
} from '@miscellary/shared';
import type { CardRenderAssets, CardTextRules, Rarity, TemplateConfig } from '@miscellary/shared';
import type { CSSProperties } from 'react';
import BakedCard from './BakedCard';
import { CopyField, PrintedCopy } from './CardCopy';
import SetMark from './SetMark';
import { resolveMark } from '@/lib/setIdentity';
import styles from './CardPreview.module.css';

export interface CardPreviewProps {
  title: string;
  rarity: Rarity;
  description: string;
  printedText?: string;
  imageUrl: string | null;
  templateKey: string;
  templateConfig: TemplateConfig;
  size?: 'small' | 'large';
  code?: string;
  mark?: string | undefined;
  lit?: boolean | undefined;
  render?: CardRenderAssets | null | undefined;
  renderMode?: 'static' | 'mask';
  textRules?: CardTextRules;
  onTitleChange?: (value: string) => void;
  onPrintedTextChange?: (value: string) => void;
}

const TEXT_TEMPLATES = new Set(['fieldnote']);

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

function spotLayers(css: Record<string, string>) {
  return (
    <>
      <i className={`${css.spot} ${css.spotField}`} aria-hidden="true" />
      <i className={`${css.spot} ${css.spotBand}`} aria-hidden="true" />
    </>
  );
}

export default function CardPreview({
  title,
  rarity,
  printedText = '',
  imageUrl,
  templateKey,
  templateConfig,
  size = 'large',
  code,
  mark,
  lit,
  render,
  renderMode,
  textRules,
  onTitleChange,
  onPrintedTextChange,
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
  // Option names are snake_case; data attributes are not. Spot work is resolved
  // rather than stored, so its attributes come from the resolver below and not
  // from whatever the config happens to carry.
  for (const [k, v] of Object.entries(currentConfig(templateConfig)))
    if (k !== 'pattern' && k !== 'coverage') data[`data-${k.replace(/_/g, '-')}`] = v;
  const shownTitle = title || 'Untitled';
  const isText = TEXT_TEMPLATES.has(templateKey);
  const rules = textRules ?? cardTextRules(templateKey);
  const line = templateKey === 'polaroid' ? shownTitle : printedText;
  const spot = resolveCardSpot(templateConfig, rarity);
  const editing = Boolean(onTitleChange);

  const titleField = (className: string) =>
    editing && onTitleChange ? (
      <CopyField
        className={className}
        region={rules.title}
        label="Printed card title"
        value={title}
        onChange={onTitleChange}
        required
      />
    ) : (
      <PrintedCopy className={className} region={rules.title} value={shownTitle} />
    );

  const printedField = (className: string) => {
    if (!rules.printed) return null;
    if (!editing || !onPrintedTextChange) {
      return line ? (
        <PrintedCopy className={className} region={rules.printed} value={line} />
      ) : null;
    }
    return (
      <CopyField
        className={className}
        region={rules.printed}
        label={rules.printed_label ?? 'Printed card copy'}
        value={printedText}
        onChange={onPrintedTextChange}
      />
    );
  };

  return (
    <div
      className={`${styles.card} ${styles[templateKey] ?? styles.classic} ${size === 'small' ? styles.small : styles.large}`}
      data-rarity={rarity}
      data-spot={spot?.material}
      data-spot-area={spot?.area}
      data-pattern={spot?.pattern}
      data-lit={lit ? '' : undefined}
      data-render={renderMode}
      style={cardVars(templateKey, templateConfig, rarity)}
      {...data}
    >
      <div className={styles.stock}>
        <i className={styles.tooth} aria-hidden="true" />
        <header className={styles.head}>
          {templateKey !== 'bold' && templateKey !== 'polaroid' ? titleField(styles.name!) : null}
          <SetMark mark={resolveMark(mark)} className={styles.mark} />
        </header>
        <div className={styles.art}>
          {renderMode !== 'mask' && imageUrl ? (
            <img src={imageUrl} alt="" />
          ) : renderMode !== 'mask' ? (
            <div className={styles.placeholder}>No photo yet</div>
          ) : null}
          {renderMode === 'mask' && spot?.area === 'spot' ? (
            <i className={styles.materialMask} aria-hidden="true" />
          ) : null}
          {renderMode === 'mask' && spot?.area === 'reverse' ? (
            <i className={styles.materialHole} aria-hidden="true" />
          ) : null}
          {!renderMode && spot?.area === 'spot' ? spotLayers(styles) : null}
        </div>
        {code ? <b className={styles.code}>{code}</b> : null}

        {isText ? (
          <div className={styles.panel}>
            {editing || printedText ? (
              printedField(styles.panelBody!)
            ) : (
              <span className={styles.panelEmpty}>No printed note yet</span>
            )}
          </div>
        ) : null}

        {templateKey === 'bold' || (!isText && (editing || line)) ? (
          <footer className={styles.foot}>
            {templateKey === 'bold' ? titleField(styles.bigTitle!) : null}
            {templateKey === 'polaroid'
              ? titleField(styles.caption!)
              : !isText
                ? printedField(styles.caption!)
                : null}
          </footer>
        ) : null}

        {!renderMode && spot && spot.area !== 'spot' ? spotLayers(styles) : null}
        {renderMode === 'mask' && spot && spot.area !== 'spot' ? (
          <i className={styles.materialMask} aria-hidden="true" />
        ) : null}
      </div>
    </div>
  );
}

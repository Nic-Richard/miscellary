import type { Rarity, TemplateConfig } from '@miscellary/shared';
import Description from './Description';
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
  lit?: boolean;
}

const TEXT_TEMPLATES = new Set(['fieldnote', 'dossier']);

export function captionFrom(description: string): string {
  const line = description
    .split(/\r?\n/)
    .map((l) => l.trim())
    .find(Boolean);
  if (!line) return '';
  const plain = line.replace(/^[-*]\s+/, '').replace(/[*_]+/g, '');
  return plain.length > 42 ? `${plain.slice(0, 40).trimEnd()}…` : plain;
}

function restOf(description: string): string {
  const lines = description.split(/\r?\n/);
  const first = lines.findIndex((l) => l.trim());
  return first === -1
    ? ''
    : lines
        .slice(first + 1)
        .join('\n')
        .trim();
}

/* Sibling layers keep blend modes against the card itself. */
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
}: CardPreviewProps) {
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
      {...data}
    >
      <div className={styles.stock}>
        <header className={styles.head}>
          {number ? <b className={styles.num}>{String(number).padStart(3, '0')}</b> : null}
          <span className={styles.name}>{shownTitle}</span>
          <SetMark mark={resolveMark(mark)} className={styles.mark} />
        </header>
        <div className={styles.art}>
          {imageUrl ? (
            <img src={imageUrl} alt="" />
          ) : (
            <div className={styles.placeholder}>No photo yet</div>
          )}
          {varnish ? <i className={styles.varnish} aria-hidden="true" /> : null}
          {chase && coverage === 'art' ? chaseLayers(styles, false) : null}
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

        {chase && coverage !== 'art' ? chaseLayers(styles, coverage === 'frame') : null}

        {!isText && size === 'large' && body ? (
          <Description text={body} className={styles.desc} />
        ) : null}
      </div>
    </div>
  );
}

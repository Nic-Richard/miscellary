import { useId } from 'react';
import type { ReactElement } from 'react';
import SetMark from './SetMark';
import { EMBLEM_TEXT_COLOURS, coversPack, packStyle, resolveMark } from '@/lib/setIdentity';
import type { PackLayer, PackTextLayer, SetIdentity } from '@/lib/setIdentity';
import { fontStack } from '@/lib/fonts';
import styles from './PackPouch.module.css';

// Coordinates are in the pack image's own pixel space (530 x 886).
const FACE = { cx: 265, cy: 440, r: 176 };

// Pale ink uses a dark plate to maintain contrast.
const PALE_INKS = new Set(['cream', 'white']);
const PLATE_DARK = '#241f1a';
const PLATE_LIGHT = '#f4eee0';

// Only round plates can carry the curved seal text.
const ROUND_SHAPES = new Set(['disc', 'hex', 'rosette']);

function roundedRect(cx: number, cy: number, w: number, h: number, k: number): string {
  const l = cx - w;
  const r = cx + w;
  const t = cy - h;
  const b = cy + h;
  return `M${l + k} ${t}H${r - k}Q${r} ${t} ${r} ${t + k}V${b - k}Q${r} ${b} ${r - k} ${b}H${l + k}Q${l} ${b} ${l} ${b - k}V${t + k}Q${l} ${t} ${l + k} ${t}Z`;
}

function rosette(cx: number, cy: number, r: number, lobes = 16): string {
  const inner = r * 0.9;
  const step = (Math.PI * 2) / lobes;
  const lobeR = (r - inner) * 0.6 + (step * inner) / 2;
  let d = '';
  for (let i = 0; i < lobes; i++) {
    const a0 = i * step - Math.PI / 2;
    const a1 = (i + 1) * step - Math.PI / 2;
    const x0 = cx + inner * Math.cos(a0);
    const y0 = cy + inner * Math.sin(a0);
    const x1 = cx + inner * Math.cos(a1);
    const y1 = cy + inner * Math.sin(a1);
    if (i === 0) d += `M${x0.toFixed(2)} ${y0.toFixed(2)}`;
    d += `A${lobeR.toFixed(2)} ${lobeR.toFixed(2)} 0 0 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
  }
  return `${d}Z`;
}

function plate(shape: string, cx: number, cy: number, r: number): string {
  const h = r * 0.866;
  switch (shape) {
    case 'hex':
      return `M${cx - r} ${cy}L${cx - r / 2} ${cy - h}L${cx + r / 2} ${cy - h}L${cx + r} ${cy}L${cx + r / 2} ${cy + h}L${cx - r / 2} ${cy + h}Z`;
    case 'diamond':
      return `M${cx} ${cy - r}L${cx + r} ${cy}L${cx} ${cy + r}L${cx - r} ${cy}Z`;
    case 'shield':
      return `M${cx - r * 0.92} ${cy - r * 0.86}H${cx + r * 0.92}V${cy + r * 0.1}C${cx + r * 0.92} ${cy + r * 0.66} ${cx + r * 0.42} ${cy + r * 0.92} ${cx} ${cy + r * 1.02}C${cx - r * 0.42} ${cy + r * 0.92} ${cx - r * 0.92} ${cy + r * 0.66} ${cx - r * 0.92} ${cy + r * 0.1}Z`;
    case 'banner':
      return roundedRect(cx, cy, r * 1.02, r * 0.66, r * 0.1);
    case 'tablet':
      return roundedRect(cx, cy, r * 0.8, r * 1.0, r * 0.2);
    case 'rosette':
      return rosette(cx, cy, r);
    default:
      return `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${r * 2} 0a${r} ${r} 0 1 0 ${-r * 2} 0Z`;
  }
}

// Bebas Neue is narrow, so a character advances roughly this fraction of the
// font size before letter spacing is added.
function fitSize(text: string, maxWidth: number, cap: number, tracking = 0.14): number {
  const per = 0.44 + tracking;
  return Math.min(cap, maxWidth / Math.max(text.length, 1) / per);
}

function wrap(label: string, limit: number): string[] {
  if (label.length <= limit) return [label];
  const words = label.split(/\s+/);
  if (words.length < 2) return [label];
  const lines: string[] = ['', ''];
  let i = 0;
  for (const word of words) {
    if (i === 0 && lines[0] && lines[0]!.length + word.length + 1 > limit) i = 1;
    lines[i] = lines[i] ? `${lines[i]} ${word}` : word;
  }
  return lines[1] ? lines : [lines[0]!];
}

export function PackEmblem({
  title,
  identity,
  scale = 100,
}: {
  title: string;
  identity: SetIdentity;
  scale?: number;
}) {
  const id = useId().replace(/:/g, '');
  const label = title.toUpperCase();
  const sub = (identity.pack_subtitle ?? '').toUpperCase();

  const layout = identity.emblem_layout || 'seal';
  const shape = identity.emblem_shape || 'disc';
  const style = identity.emblem_style || 'filled';
  const ink = EMBLEM_TEXT_COLOURS[identity.emblem_text || 'teal'] ?? EMBLEM_TEXT_COLOURS['teal']!;
  const board = PALE_INKS.has(identity.emblem_text || '') ? PLATE_DARK : PLATE_LIGHT;

  const r = FACE.r * (scale / 100);
  const markScale = (identity.mark_scale ?? 100) / 100;
  const typeScale = (identity.emblem_type_scale ?? 100) / 100;
  const cx = FACE.cx;
  const cy = FACE.cy;

  const plated = layout !== 'wordmark' && shape !== 'none' && style !== 'transparent';
  const print = !plated;

  const strokeUnit = r * 0.019;

  function Plate() {
    if (!plated) return null;
    return (
      <>
        <path
          d={plate(shape, cx, cy, r)}
          fill={style === 'outline' ? 'rgba(248,243,232,.1)' : board}
          stroke="rgba(20,58,54,.22)"
          strokeWidth={r * 0.012}
        />
        <path
          d={plate(shape, cx, cy, r * 0.94)}
          fill="none"
          stroke={ink}
          strokeOpacity="0.75"
          strokeWidth={strokeUnit}
        />
        <path
          d={plate(shape, cx, cy, r * 0.885)}
          fill="none"
          stroke={ink}
          strokeOpacity="0.4"
          strokeWidth={r * 0.007}
        />
      </>
    );
  }

  function Mark({ size, y }: { size: number; y: number }) {
    if (resolveMark(identity.mark) === 'none') return null;
    return (
      <svg
        x={cx - size / 2}
        y={y - size / 2}
        width={size}
        height={size}
        viewBox="0 0 24 24"
        overflow="visible"
      >
        <SetMark
          mark={resolveMark(identity.mark)}
          className={styles.emblemMark}
          style={{ stroke: ink, strokeWidth: 1.5 }}
        />
      </svg>
    );
  }

  function measure(maxWidth: number, cap: number, limit = 16) {
    const lines = wrap(label, limit);
    const longest = lines.reduce((a, b) => (b.length > a.length ? b : a), '');
    const size = fitSize(longest, maxWidth, cap) * typeScale;
    return { lines, size, height: lines.length * size * 0.92 };
  }

  function Title({ y, lines, size }: { y: number; lines: string[]; size: number }) {
    const gap = size * 0.92;
    const top = lines.length > 1 ? y - gap / 2 : y;
    return (
      <>
        {lines.map((text, i) => (
          <text
            key={text}
            x={cx}
            y={top + i * gap}
            fill={ink}
            fontFamily="var(--display)"
            fontSize={size}
            letterSpacing="0.14em"
            textAnchor="middle"
          >
            {text}
          </text>
        ))}
      </>
    );
  }

  function Sub({ y, size }: { y: number; size: number }) {
    if (!sub) return null;
    const scaled = size * typeScale;
    return (
      <text
        x={cx}
        y={y}
        fill={ink}
        opacity="0.62"
        fontFamily="var(--body)"
        fontSize={scaled}
        fontWeight="700"
        letterSpacing="0.24em"
        textAnchor="middle"
      >
        {sub}
      </text>
    );
  }

  function Rule({ y, width, opacity = 0.55 }: { y: number; width: number; opacity?: number }) {
    return (
      <line
        x1={cx - width}
        y1={y}
        x2={cx + width}
        y2={y}
        stroke={ink}
        strokeOpacity={opacity}
        strokeWidth={strokeUnit * 0.8}
        strokeLinecap="round"
      />
    );
  }

  function Seal() {
    const round = ROUND_SHAPES.has(shape) && plated;
    const arcR = r * 0.7;
    const arcCy = cy + r * 0.05;
    if (!round) {
      return (
        <>
          <Mark size={r * 0.5 * markScale} y={cy - r * 0.02} />
          <Rule y={cy + r * 0.3} width={r * 0.5} opacity={0.4} />
          <Title y={cy - r * 0.46} {...measure(r * 1.55, r * 0.17)} />
          <Sub y={cy + r * 0.55} size={Math.max(9, r * 0.072)} />
        </>
      );
    }
    const titleSize =
      Math.min(r * 0.155, (Math.PI * arcR * 0.92) / Math.max(label.length, 6) / 0.62) * typeScale;
    return (
      <>
        <path
          d={`M${cx - r * 0.845} ${arcCy}l${r * 0.032} ${-r * 0.032}l${r * 0.032} ${r * 0.032}l${-r * 0.032} ${r * 0.032}Z`}
          fill={ink}
          opacity="0.75"
        />
        <path
          d={`M${cx + r * 0.781} ${arcCy}l${r * 0.032} ${-r * 0.032}l${r * 0.032} ${r * 0.032}l${-r * 0.032} ${r * 0.032}Z`}
          fill={ink}
          opacity="0.75"
        />
        <Mark size={r * 0.58 * markScale} y={cy - r * 0.06} />
        <text
          fill={ink}
          fontFamily="var(--display)"
          fontSize={titleSize}
          letterSpacing="0.18em"
          textAnchor="middle"
        >
          <textPath href={`#${id}-top`} startOffset="50%">
            {label}
          </textPath>
        </text>
        <text
          fill={ink}
          opacity="0.6"
          fontFamily="var(--body)"
          fontSize={Math.max(9, r * 0.072) * typeScale}
          fontWeight="700"
          letterSpacing="0.24em"
          textAnchor="middle"
        >
          <textPath href={`#${id}-bottom`} startOffset="50%">
            {sub}
          </textPath>
        </text>
      </>
    );
  }

  function Stacked() {
    return (
      <>
        <Mark size={r * 0.46 * markScale} y={cy - r * 0.42} />
        <Rule y={cy - r * 0.08} width={r * 0.46} opacity={0.45} />
        <Title y={cy + r * 0.24} {...measure(r * 1.5, r * 0.2)} />
        <Rule y={cy + r * 0.42} width={r * 0.28} opacity={0.3} />
        <Sub y={cy + r * 0.62} size={Math.max(9, r * 0.075)} />
      </>
    );
  }

  function Wordmark() {
    const { lines, size, height } = measure(392, r * 0.34, 13);
    const half = height / 2;
    const rule = Math.min(196, size * 4.6);
    return (
      <>
        <Rule y={cy - half - r * 0.16} width={rule} opacity={0.5} />
        <Title y={cy + size * 0.34} lines={lines} size={size} />
        <Rule y={cy + half + r * 0.12} width={rule} opacity={0.5} />
        <Sub y={cy + half + r * 0.32} size={Math.max(10, r * 0.08)} />
      </>
    );
  }

  function Badge() {
    return (
      <>
        <Mark size={r * 0.58 * markScale} y={cy - r * 0.42} />
        <rect
          x={cx - r * 0.78}
          y={cy - r * 0.04}
          width={r * 1.56}
          height={r * 0.05}
          fill={ink}
          opacity="0.7"
          rx={r * 0.025}
        />
        <Title y={cy + r * 0.26} {...measure(r * 1.55, r * 0.2)} />
        <Sub y={cy + r * 0.56} size={Math.max(9, r * 0.072)} />
      </>
    );
  }

  function Crest() {
    const ribbonY = cy + r * 0.42;
    const ribbonH = r * 0.19;
    return (
      <>
        <Mark size={r * 0.72 * markScale} y={cy - r * 0.3} />
        <path
          d={`M${cx - r * 0.98} ${ribbonY - ribbonH}H${cx + r * 0.98}V${ribbonY + ribbonH}H${cx - r * 0.98}Z`}
          fill={ink}
          opacity="0.88"
        />
        <path
          d={`M${cx - r * 0.98} ${ribbonY - ribbonH}l${-r * 0.16} ${ribbonH}l${r * 0.16} ${ribbonH}Z`}
          fill={ink}
          opacity="0.5"
        />
        <path
          d={`M${cx + r * 0.98} ${ribbonY - ribbonH}l${r * 0.16} ${ribbonH}l${-r * 0.16} ${ribbonH}Z`}
          fill={ink}
          opacity="0.5"
        />
        <text
          x={cx}
          y={ribbonY + r * 0.06}
          fill={board}
          fontFamily="var(--display)"
          fontSize={fitSize(label, r * 1.8, r * 0.16) * typeScale}
          letterSpacing="0.14em"
          textAnchor="middle"
        >
          {label}
        </text>
        <Sub y={cy + r * 1.2} size={Math.max(9, r * 0.072)} />
      </>
    );
  }

  const arcR = r * 0.7;
  const arcCy = cy + r * 0.05;
  const LAYOUTS: Record<string, () => ReactElement> = {
    seal: Seal,
    stacked: Stacked,
    wordmark: Wordmark,
    badge: Badge,
    crest: Crest,
  };
  const Body = LAYOUTS[layout] ?? Seal;

  return (
    <svg className={styles.emblem} viewBox="0 0 530 886" aria-hidden="true">
      <defs>
        <path
          id={`${id}-top`}
          d={`M${cx - arcR} ${arcCy}a${arcR} ${arcR} 0 0 1 ${arcR * 2} 0`}
          fill="none"
        />
        <path
          id={`${id}-bottom`}
          d={`M${cx - arcR * 0.94} ${arcCy}a${arcR * 0.94} ${arcR * 0.94} 0 0 0 ${arcR * 1.88} 0`}
          fill="none"
        />
        <filter id={`${id}-print`} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow
            dx="0"
            dy="1.5"
            stdDeviation="1.2"
            floodColor="#0d2b28"
            floodOpacity="0.45"
          />
        </filter>
      </defs>

      <g filter={print ? `url(#${id}-print)` : undefined}>
        <Plate />
        <Body />
      </g>
    </svg>
  );
}

// Alignment also sets the anchor, while cqw keeps placement responsive.
function TextLayer({ layer }: { layer: PackTextLayer }) {
  return (
    <span
      className={styles.textLayer}
      style={{
        left: `${50 + layer.x}%`,
        top: `${50 + layer.y}%`,
        transform: `translate(-50%, -50%) rotate(${layer.rotate}deg)`,
        fontFamily: fontStack(layer.font),
        fontSize: `${layer.size}cqw`,
        letterSpacing: `${layer.tracking / 100}em`,
        color: EMBLEM_TEXT_COLOURS[layer.colour] ?? EMBLEM_TEXT_COLOURS['cream'],
      }}
    >
      {layer.text}
    </span>
  );
}

// Centre-origin transforms keep a layer fixed while it is scaled or rotated.
function Layer({
  layer,
  title,
  identity,
}: {
  layer: PackLayer;
  title: string;
  identity: SetIdentity;
}) {
  if (layer.hidden) return null;

  const transform = `translate(-50%, -50%) rotate(${layer.rotate}deg) scale(${layer.flip_x ? -1 : 1}, ${layer.flip_y ? -1 : 1})`;
  const place = {
    left: `${50 + layer.x}%`,
    top: `${49.7 + layer.y}%`,
    opacity: layer.opacity / 100,
    transform,
  };

  if (layer.kind === 'emblem') {
    return (
      <span className={styles.emblemLayer} style={place}>
        <PackEmblem title={title} identity={identity} scale={layer.scale} />
      </span>
    );
  }
  return (
    <img
      className={styles.art}
      src={layer.url}
      alt=""
      draggable={false}
      style={{ ...place, width: `${layer.scale}%` }}
    />
  );
}

export default function PackPouch({
  title,
  identity = {},
  className,
}: {
  title: string;
  identity?: SetIdentity;
  className?: string | undefined;
}) {
  const front = identity.pack_layers ?? [];
  const lines = (identity.pack_text ?? []).filter((line) => !line.hidden);
  const covered = front.some(coversPack);
  const finish = identity.pack_finish || 'gloss';
  // Full-coverage art needs more of the wrapper's shading restored.
  const relight = finish === 'matte' ? (covered ? 0.7 : 0.3) : covered ? 0.92 : 0.45;

  return (
    <div
      className={`${styles.pouch} ${className ?? ''}`}
      style={packStyle(identity.pack_colour)}
      data-finish={finish}
      role="img"
      aria-label={`${title} pack`}
    >
      <img className={styles.foil} src="/materials/pack-blank.png" alt="" draggable={false} />

      {finish === 'matte' ? (
        <img
          className={styles.flatten}
          src="/materials/pack-shading.png"
          alt=""
          aria-hidden="true"
        />
      ) : null}

      <span className={styles.printed}>
        {front.map((layer, i) => (
          <Layer
            key={`${layer.kind}-${layer.image_id}-${i}`}
            layer={layer}
            title={title}
            identity={identity}
          />
        ))}

        {lines.map((line, i) => (
          <TextLayer key={`${line.text}-${i}`} layer={line} />
        ))}

        <img
          className={styles.shading}
          src="/materials/pack-shading.png"
          alt=""
          aria-hidden="true"
          style={{ opacity: relight }}
        />
      </span>

      <span className={styles.finish} aria-hidden="true" />
    </div>
  );
}

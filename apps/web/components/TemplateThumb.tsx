/* Compact layout sketches for the template picker.
   Enough to tell the layouts apart at a glance without rendering a card. */

interface Block {
  x: number;
  y: number;
  w: number;
  h: number;
  kind?: 'photo' | 'rule' | 'title';
}

const W = 40;
const H = 56;

const LAYOUTS: Record<string, Block[]> = {
  classic: [
    { x: 6, y: 5, w: 22, h: 3, kind: 'title' },
    { x: 6, y: 12, w: 28, h: 26, kind: 'photo' },
    { x: 6, y: 43, w: 28, h: 2 },
    { x: 6, y: 47, w: 20, h: 2 },
  ],
  fieldnote: [
    { x: 6, y: 5, w: 22, h: 3, kind: 'title' },
    { x: 6, y: 12, w: 28, h: 20, kind: 'photo' },
    { x: 6, y: 36, w: 28, h: 15, kind: 'rule' },
  ],
  minimal: [
    { x: 3, y: 3, w: 34, h: 50, kind: 'photo' },
    { x: 7, y: 41, w: 22, h: 3, kind: 'title' },
    { x: 7, y: 47, w: 26, h: 2 },
  ],
  polaroid: [
    { x: 5, y: 5, w: 30, h: 31, kind: 'photo' },
    { x: 7, y: 44, w: 24, h: 3, kind: 'title' },
  ],
  bold: [
    { x: 4, y: 4, w: 32, h: 30, kind: 'photo' },
    { x: 6, y: 39, w: 28, h: 6, kind: 'title' },
    { x: 6, y: 48, w: 22, h: 2 },
  ],
};

const FILL = {
  photo: 'currentColor',
  rule: 'none',
  title: 'currentColor',
  plain: 'currentColor',
};

export default function TemplateThumb({ layout }: { layout: string }) {
  const blocks = LAYOUTS[layout] ?? LAYOUTS.classic!;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="26" height="36" aria-hidden="true" focusable="false">
      <rect
        x="0.75"
        y="0.75"
        width={W - 1.5}
        height={H - 1.5}
        rx="3"
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.4"
        strokeWidth="1.5"
      />
      {blocks.map((block, index) => (
        <rect
          key={index}
          x={block.x}
          y={block.y}
          width={block.w}
          height={block.h}
          rx={block.h > 6 ? 1.5 : 1}
          fill={FILL[block.kind ?? 'plain']}
          fillOpacity={block.kind === 'photo' ? 0.42 : 0.72}
          stroke={block.kind === 'rule' ? 'currentColor' : 'none'}
          strokeOpacity="0.45"
          strokeDasharray={block.kind === 'rule' ? '2 2' : undefined}
        />
      ))}
    </svg>
  );
}

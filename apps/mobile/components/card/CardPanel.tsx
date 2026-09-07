import { useState } from 'react';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import type { ViewStyle } from 'react-native';
import Svg, { Circle, Defs, Line, Pattern, Rect } from 'react-native-svg';
import type { CardTokens } from '@miscellary/shared';
import { fade, mix, share } from './geometry';

const RULE = { fieldnote: 'rgba(96, 132, 146, 0.28)', dossier: 'rgba(178, 206, 214, 0.26)' };

const BOARDS: Record<string, { background: string; ring: string }> = {
  fieldnote: { background: '#fffdf6', ring: 'rgba(120, 104, 74, 0.22)' },
  dossier: { background: 'rgba(0, 0, 0, 0.26)', ring: 'rgba(255, 255, 255, 0.12)' },
};

const AGED: Record<string, string> = { fieldnote: '#f8efd9', dossier: 'rgba(0, 0, 0, 0.38)' };

// React Native has no repeating background image; use SVG patterns.
function Paper({
  paper,
  rule,
  width,
  cardWidth,
  height,
  id,
}: {
  paper: string;
  rule: string;
  width: number;
  cardWidth: number;
  height: number;
  id: string;
}) {
  const s = (value: number) => share(cardWidth, value);
  if (width <= 0 || height <= 0) return null;
  if (paper === 'ruled') {
    const step = s(6.65);
    return (
      <Svg width={width} height={height} style={{ position: 'absolute' }}>
        <Defs>
          <Pattern id={id} width={width} height={step} patternUnits="userSpaceOnUse" y={s(2.2)}>
            <Line x1={0} y1={step} x2={width} y2={step} stroke={rule} strokeWidth={s(0.5)} />
          </Pattern>
        </Defs>
        <Rect width={width} height={height} fill={`url(#${id})`} />
      </Svg>
    );
  }
  if (paper === 'grid') {
    const step = s(5.2);
    return (
      <Svg width={width} height={height} style={{ position: 'absolute' }}>
        <Defs>
          <Pattern id={id} width={step} height={step} patternUnits="userSpaceOnUse">
            <Line x1={0} y1={step} x2={step} y2={step} stroke={rule} strokeWidth={s(0.4)} />
            <Line x1={step} y1={0} x2={step} y2={step} stroke={rule} strokeWidth={s(0.4)} />
          </Pattern>
        </Defs>
        <Rect width={width} height={height} fill={`url(#${id})`} />
      </Svg>
    );
  }
  if (paper === 'dot') {
    const step = s(5);
    return (
      <Svg width={width} height={height} style={{ position: 'absolute' }}>
        <Defs>
          <Pattern
            id={id}
            width={step}
            height={step}
            patternUnits="userSpaceOnUse"
            x={s(1.5)}
            y={s(2.4)}
          >
            <Circle cx={s(0.55)} cy={s(0.55)} r={s(0.55)} fill={rule} />
          </Pattern>
        </Defs>
        <Rect width={width} height={height} fill={`url(#${id})`} />
      </Svg>
    );
  }
  return null;
}

export default function CardPanel({
  templateKey,
  paper = 'plain',
  tokens,
  cardWidth,
  style,
  patternId,
  children,
}: {
  templateKey: string;
  paper?: string;
  tokens: CardTokens;
  cardWidth: number;
  style?: ViewStyle;
  patternId: string;
  children: ReactNode;
}) {
  const s = (value: number) => share(cardWidth, value);
  const board = BOARDS[templateKey] ?? BOARDS.fieldnote!;
  const rule = RULE[templateKey as keyof typeof RULE] ?? RULE.fieldnote;
  const [box, setBox] = useState({ width: 0, height: 0 });

  const surface: ViewStyle = {
    flex: 1,
    minHeight: 0,
    marginTop: s(2.6),
    paddingVertical: s(2.6),
    paddingHorizontal: s(3),
    borderRadius: s(1.4),
    overflow: 'hidden',
    backgroundColor: board.background,
    boxShadow: [
      { offsetX: 0, offsetY: 0, blurRadius: 0, spreadDistance: 1, color: board.ring, inset: true },
      {
        offsetX: 0,
        offsetY: s(0.5),
        blurRadius: s(1),
        color: templateKey === 'dossier' ? 'rgba(0, 0, 0, 0.35)' : 'rgba(90, 72, 40, 0.09)',
        inset: true,
      },
    ],
  };

  if (paper === 'label') {
    surface.backgroundColor = '#f7f0df';
    surface.borderRadius = 0;
    surface.borderWidth = s(0.6);
    surface.borderColor = '#c8baa0';
    surface.boxShadow = [];
  } else if (paper === 'inset') {
    surface.backgroundColor = mix(tokens.stock, 90, '#000000');
    surface.borderWidth = s(0.3);
    surface.borderColor = fade(tokens.ink, 25);
    surface.boxShadow = [
      { offsetX: 0, offsetY: s(0.8), blurRadius: s(1.8), color: 'rgba(0, 0, 0, 0.2)', inset: true },
    ];
  } else if (paper === 'tinted') {
    surface.backgroundColor = mix(tokens.stock, 85, tokens.accent);
    surface.borderLeftWidth = s(1);
    surface.borderLeftColor = tokens.accent;
    surface.boxShadow = [];
  } else if (paper === 'transparent') {
    surface.backgroundColor = 'transparent';
    surface.paddingHorizontal = 0;
    surface.boxShadow = [];
  } else if (paper === 'aged') {
    surface.backgroundColor = AGED[templateKey] ?? AGED.fieldnote!;
  }

  return (
    <View
      style={[surface, style]}
      onLayout={(event) => setBox(event.nativeEvent.layout)}
      collapsable={false}
    >
      <Paper
        paper={paper}
        rule={rule}
        width={box.width}
        height={box.height}
        cardWidth={cardWidth}
        id={patternId}
      />
      {children}
    </View>
  );
}

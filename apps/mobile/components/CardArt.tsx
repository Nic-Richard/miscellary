import { useId, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import type { ViewStyle } from 'react-native';
import Svg, { ClipPath, Defs, Image, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { materialColors } from './CardMaterial';

export default function CardArt({
  uri,
  shape,
  ink,
  border,
  tint,
  treatment,
  relief,
}: {
  uri: string | null;
  shape: string;
  ink: string;
  border: number;
  tint?: string;
  treatment?: string;
  relief?: string;
}) {
  const id = useId().replace(/:/g, '');
  const [size, setSize] = useState({ width: 100, height: 140 });
  const { width: w, height: h } = size;
  const b = Math.min(border, w * 0.5, h * 0.5) / 2;
  const material = materialColors(relief === 'spot' ? 'gloss' : undefined, treatment);
  const path =
    shape === 'circle'
      ? `M ${b} ${h / 2} a ${w / 2 - b} ${h / 2 - b} 0 1 0 ${w - border} 0 a ${w / 2 - b} ${h / 2 - b} 0 1 0 ${border - w} 0`
      : shape === 'diamond'
        ? `M ${w / 2} ${b} L ${w - b} ${h / 2} ${w / 2} ${h - b} ${b} ${h / 2} Z`
        : shape === 'hex'
          ? `M ${w / 2} ${b} L ${w - b} ${h / 4} ${w - b} ${h * 0.75} ${w / 2} ${h - b} ${b} ${h * 0.75} ${b} ${h / 4} Z`
          : shape === 'arch'
            ? `M ${b} ${h - b} L ${b} ${h * 0.45} C ${b} ${b} ${w - b} ${b} ${w - b} ${h * 0.45} L ${w - b} ${h - b} Z`
            : '';
  const filters: Record<string, ViewStyle['filter']> = {
    mono: [{ grayscale: 1 }],
    sepia: [{ sepia: 0.8 }],
    punch: [{ saturate: 1.2 }, { contrast: 1.08 }],
    faded: [{ saturate: 0.7 }, { contrast: 0.88 }],
    warm: [{ sepia: 0.18 }],
    cool: [{ saturate: 0.85 }],
  };
  const mask = path ? (
    <Path d={path} />
  ) : (
    <Rect
      x={b}
      y={b}
      width={Math.max(0, w - border)}
      height={Math.max(0, h - border)}
      rx={w * 0.015}
    />
  );
  return (
    <View
      style={[StyleSheet.absoluteFill, { filter: filters[tint ?? ''] }]}
      onLayout={(event) => setSize(event.nativeEvent.layout)}
    >
      <Svg width="100%" height="100%">
        <Defs>
          <ClipPath id={id}>{mask}</ClipPath>
          <LinearGradient id={`${id}-finish`} x1="0%" y1="25%" x2="100%" y2="75%">
            {material.map((color, i) => (
              <Stop key={i} offset={i / (material.length - 1)} stopColor={color} />
            ))}
          </LinearGradient>
        </Defs>
        <Rect width={w} height={h} fill="#d9d0be" clipPath={`url(#${id})`} />
        {uri ? (
          <Image
            href={{ uri }}
            width={w}
            height={h}
            preserveAspectRatio="xMidYMid slice"
            clipPath={`url(#${id})`}
          />
        ) : null}
        {(treatment && treatment !== 'none') || relief === 'spot' ? (
          <Rect width={w} height={h} fill={`url(#${id}-finish)`} clipPath={`url(#${id})`} />
        ) : null}
        {path ? (
          <Path d={path} stroke={ink} strokeWidth={border} fill="none" />
        ) : (
          <Rect
            x={b}
            y={b}
            width={Math.max(0, w - border)}
            height={Math.max(0, h - border)}
            rx={w * 0.015}
            stroke={ink}
            strokeWidth={border}
            fill="none"
          />
        )}
      </Svg>
    </View>
  );
}

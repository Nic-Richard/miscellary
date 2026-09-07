import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet } from 'react-native';
import { useId } from 'react';
import Svg, { Defs, LinearGradient as SvgGradient, Rect, Stop } from 'react-native-svg';

export const CARD_LIGHT = { start: { x: 0, y: 0.25 }, end: { x: 1, y: 0.75 } };

export function CardEdge({
  width,
  radius,
  treatment,
  relief,
}: {
  width: number;
  radius: number;
  treatment?: string;
  relief?: string;
}) {
  const id = useId().replace(/:/g, '');
  const stroke = width * 0.012;
  const colors = materialColors(undefined, treatment);
  const raised = relief === 'emboss';
  const pressed = relief === 'deboss';
  return (
    <Svg
      pointerEvents="none"
      width="100%"
      height="100%"
      style={StyleSheet.absoluteFill}
      viewBox={`0 0 ${width} ${width * 1.4}`}
    >
      <Defs>
        <SvgGradient id={id} x1="0%" y1="25%" x2="100%" y2="75%">
          {colors.map((color, i) => (
            <Stop key={i} offset={i / (colors.length - 1)} stopColor={color} />
          ))}
        </SvgGradient>
        <SvgGradient id={`${id}-relief`} x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset={0} stopColor={pressed ? '#110e0b66' : '#fff8e67a'} />
          <Stop offset={0.5} stopColor="#ffffff00" />
          <Stop offset={1} stopColor={pressed ? '#fff8e655' : '#110e0b66'} />
        </SvgGradient>
      </Defs>
      {treatment && treatment !== 'none' ? (
        <Rect
          x={stroke / 2}
          y={stroke / 2}
          width={width - stroke}
          height={width * 1.4 - stroke}
          rx={Math.max(0, radius - stroke / 2)}
          fill="none"
          stroke={`url(#${id})`}
          strokeWidth={stroke * 2}
        />
      ) : null}
      {raised || pressed ? (
        <Rect
          x={stroke}
          y={stroke}
          width={width - stroke * 2}
          height={width * 1.4 - stroke * 2}
          rx={Math.max(0, radius - stroke)}
          fill="none"
          stroke={`url(#${id}-relief)`}
          strokeWidth={stroke * 0.7}
        />
      ) : null}
    </Svg>
  );
}

export function materialColors(finish?: string, treatment?: string) {
  const colors: readonly [string, string, ...string[]] =
    treatment === 'holo'
      ? ['#ff78a529', '#ffd66e26', '#78ecb021', '#6ec4ff26', '#ba8cff29']
      : treatment === 'foil'
        ? ['#ffe0a024', '#fff8d636', '#ba8c3a19', '#fff4ca33']
        : finish === 'pearl'
          ? ['#c6b2ff33', '#ffffff29', '#aad6ff29', '#d4b0ff33']
          : finish === 'metallic'
            ? ['#ffbe8e19', '#fff0de4d', '#c4764614', '#fff6e857', '#ffeCD63d']
            : finish === 'gloss'
              ? ['#ffffff00', '#ffffff08', '#ffffff33', '#ffffff00']
              : finish === 'satin'
                ? ['#ffffff00', '#ffffff1f', '#ffffff00']
                : ['#ffffff00', '#ffffff08', '#ffffff00'];
  return colors;
}

export default function CardMaterial({
  finish,
  treatment,
}: {
  finish?: string;
  treatment?: string;
}) {
  return (
    <LinearGradient
      pointerEvents="none"
      colors={materialColors(finish, treatment)}
      start={CARD_LIGHT.start}
      end={CARD_LIGHT.end}
      style={StyleSheet.absoluteFill}
    />
  );
}

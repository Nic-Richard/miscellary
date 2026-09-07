import { View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { CardMaterial } from '@miscellary/shared';
import { gradientGeometry, share } from './geometry';

export function CardFinish({
  material,
  width,
  height,
  light = 1,
}: {
  material: CardMaterial;
  width: number;
  height: number;
  light?: number;
}) {
  return (
    <LinearGradient
      {...gradientGeometry(material.coat, width, height)}
      pointerEvents="none"
      style={{
        position: 'absolute',
        inset: 0,
        opacity: material.sheen * light,
        mixBlendMode: material.coatBlend as 'soft-light',
      }}
    />
  );
}

export function CardRelief({
  material,
  width,
  corner,
}: {
  material: CardMaterial;
  width: number;
  corner: number;
}) {
  if (!material.relief) return null;
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        inset: 0,
        borderRadius: corner,
        boxShadow: material.relief.map((shadow) => ({
          offsetX: 0,
          offsetY: 0,
          blurRadius: share(width, shadow.blur),
          spreadDistance: share(width, shadow.spread),
          color: shadow.color,
          inset: true,
        })),
      }}
    />
  );
}

const VARNISH = {
  angle: 104,
  stops: [
    { color: 'rgba(255, 255, 255, 0)', at: 22 },
    { color: 'rgba(255, 255, 255, 0.26)', at: 44 },
    { color: 'rgba(255, 255, 255, 0.06)', at: 58 },
    { color: 'rgba(255, 255, 255, 0)', at: 82 },
  ],
};

export function CardVarnish({
  width,
  height,
  light = 1,
}: {
  width: number;
  height: number;
  light?: number;
}) {
  return (
    <LinearGradient
      {...gradientGeometry(VARNISH, width, height)}
      pointerEvents="none"
      style={{
        position: 'absolute',
        inset: 0,
        opacity: 0.8 * light,
        mixBlendMode: 'screen',
      }}
    />
  );
}

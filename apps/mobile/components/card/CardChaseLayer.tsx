import { View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { Chase } from '@miscellary/shared';
import { expandRepeating } from '@miscellary/shared';
import { gradientGeometry } from './geometry';

export default function CardChase({
  chase,
  width,
  height,
  light = 1,
}: {
  chase: Chase | null;
  width: number;
  height: number;
  light?: number;
}) {
  if (!chase) return null;
  const band = chase.band;
  const bandWidth = width * band.scale;
  const bandHeight = height * band.scale;

  return (
    <>
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          inset: 0,
          opacity: chase.field.opacity,
          mixBlendMode: chase.field.blend as 'overlay',
        }}
      >
        <LinearGradient
          {...gradientGeometry(chase.field.sheet, width, height)}
          style={{ position: 'absolute', inset: 0 }}
        />
        <LinearGradient
          {...gradientGeometry(expandRepeating(chase.field.stripes, width), width, height)}
          style={{ position: 'absolute', inset: 0 }}
        />
      </View>

      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          inset: 0,
          overflow: 'hidden',
          opacity: band.opacity * light,
          mixBlendMode: band.blend as 'hard-light',
        }}
      >
        <LinearGradient
          {...gradientGeometry(band.gradient, bandWidth, bandHeight)}
          style={{
            position: 'absolute',
            width: bandWidth,
            height: bandHeight,
            left: (width - bandWidth) / 2,
            top: (height - bandHeight) / 2,
          }}
        />
      </View>
    </>
  );
}

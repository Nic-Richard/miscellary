import { View } from 'react-native';
import Svg, { Defs, Image as SvgImage, Pattern, Rect } from 'react-native-svg';
import type { TextureTokens } from '@miscellary/shared';
import brushed from '../../assets/tex-brushed.png';
import canvas from '../../assets/tex-canvas.png';
import felt from '../../assets/tex-felt.png';
import grain from '../../assets/tex-grain.png';
import linen from '../../assets/tex-linen.png';

// Android textures tile through SVG patterns.

const TEXTURES: Record<string, number> = { linen, canvas, grain, felt, brushed };

function Tiled({
  source,
  tile,
  width,
  height,
  patternId,
}: {
  source: number;
  tile: number;
  width: number;
  height: number;
  patternId: string;
}) {
  return (
    <Svg width={width} height={height}>
      <Defs>
        <Pattern id={patternId} width={tile} height={tile} patternUnits="userSpaceOnUse">
          <SvgImage href={source} width={tile} height={tile} preserveAspectRatio="xMidYMid slice" />
        </Pattern>
      </Defs>
      <Rect x={0} y={0} width={width} height={height} fill={`url(#${patternId})`} />
    </Svg>
  );
}

export function CardTexture({
  texture,
  width,
  height,
}: {
  texture: TextureTokens | null;
  width: number;
  height: number;
}) {
  const name = texture?.image;
  if (!name || name === 'none') return null;
  const source = TEXTURES[name];
  if (!source) return null;
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        inset: 0,
        opacity: texture?.opacity ?? 0.45,
        mixBlendMode: (texture?.blend ?? 'multiply') as 'multiply',
      }}
    >
      <Tiled
        source={source}
        tile={texture?.size ?? 256}
        width={width}
        height={height}
        patternId={`tex-${name}`}
      />
    </View>
  );
}

export function CardGrain({
  opacity,
  width,
  height,
  corner,
}: {
  opacity: number;
  width: number;
  height: number;
  corner: number;
}) {
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        inset: 0,
        borderRadius: corner,
        overflow: 'hidden',
        opacity,
        mixBlendMode: 'overlay',
      }}
    >
      <Tiled
        source={TEXTURES.grain!}
        tile={58}
        width={width}
        height={height}
        patternId="tex-grain-pass"
      />
    </View>
  );
}

import { useState } from 'react';
import { Image, View } from 'react-native';
import Svg, { ClipPath, Defs, Image as SvgImage, Path } from 'react-native-svg';

export type WindowShape = 'square' | 'arch' | 'circle' | 'diamond' | 'hex';

const SVG_SHAPES = new Set<WindowShape>(['arch', 'diamond', 'hex']);

function roundedRect(w: number, h: number, r: number): string {
  const radius = Math.max(Math.min(r, w / 2, h / 2), 0);
  return `M${radius} 0H${w - radius}Q${w} 0 ${w} ${radius}V${h - radius}Q${w} ${h} ${w - radius} ${h}H${radius}Q0 ${h} 0 ${h - radius}Z`;
}

function shapePath(shape: WindowShape, w: number, h: number, radius: number, base: number): string {
  switch (shape) {
    case 'arch': {
      const rise = h * 0.46;
      const r = Math.min(base, w / 2, h / 2);
      return `M0 ${rise}A${w / 2} ${rise} 0 0 1 ${w} ${rise}V${h - r}Q${w} ${h} ${w - r} ${h}H${r}Q0 ${h} 0 ${h - r}Z`;
    }
    case 'hex':
      return `M${w / 2} 0L${w} ${h * 0.25}L${w} ${h * 0.75}L${w / 2} ${h}L0 ${h * 0.75}L0 ${h * 0.25}Z`;
    case 'diamond':
      return roundedRect(w, h, base);
    default:
      return roundedRect(w, h, radius);
  }
}

// Rotate the clip path so the photo stays upright.
function shapeTransform(shape: WindowShape, w: number, h: number): string | undefined {
  if (shape !== 'diamond') return undefined;
  const cx = w / 2;
  const cy = h / 2;
  return `translate(${cx}, ${cy}) rotate(45) scale(0.76) translate(${-cx}, ${-cy})`;
}

export default function CardWindow({
  shape = 'square',
  imageUrl,
  radius,
  base,
  border = 0,
  borderColour = '#bfb29a',
  background = '#d9d0be',
  clipId = 'window',
}: {
  shape?: WindowShape;
  imageUrl: string | null;

  radius: number;

  base: number;
  border?: number;
  borderColour?: string;
  background?: string;
  clipId?: string;
}) {
  const [box, setBox] = useState({ width: 0, height: 0 });
  const svg = SVG_SHAPES.has(shape);

  if (!svg) {
    const circle = shape === 'circle';
    return (
      <View
        style={{
          flex: 1,
          borderRadius: circle ? 9999 : radius,
          borderWidth: border,
          borderColor: borderColour,
          backgroundColor: background,
          overflow: 'hidden',
        }}
      >
        {imageUrl ? (
          <Image
            source={{ uri: imageUrl }}
            resizeMode="cover"
            style={{ position: 'absolute', inset: 0 }}
          />
        ) : null}
      </View>
    );
  }

  const { width, height } = box;
  const outer = width > 0 ? shapePath(shape, width, height, radius, base) : '';
  const innerW = width - border * 2;
  const innerH = height - border * 2;
  const transform = shapeTransform(shape, innerW, innerH);

  return (
    <View
      style={{ flex: 1 }}
      onLayout={(event) => setBox(event.nativeEvent.layout)}
      collapsable={false}
    >
      {width > 0 ? (
        <Svg width={width} height={height}>
          <Defs>
            <ClipPath id={clipId}>
              <Path
                d={shapePath(shape, innerW, innerH, radius, base)}
                transform={transform}
                translateX={border}
                translateY={border}
              />
            </ClipPath>
          </Defs>
          {border > 0 ? (
            <Path d={outer} fill={borderColour} transform={shapeTransform(shape, width, height)} />
          ) : null}
          <Path
            d={shapePath(shape, innerW, innerH, radius, base)}
            transform={transform}
            translateX={border}
            translateY={border}
            fill={background}
          />
          {imageUrl ? (
            <SvgImage
              href={{ uri: imageUrl }}
              x={border}
              y={border}
              width={innerW}
              height={innerH}
              preserveAspectRatio="xMidYMid slice"
              clipPath={`url(#${clipId})`}
            />
          ) : null}
        </Svg>
      ) : null}
    </View>
  );
}

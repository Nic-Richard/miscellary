import { useId } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, {
  Defs,
  Image as SvgImage,
  LinearGradient as SvgLinearGradient,
  Mask,
  Rect,
  Stop,
} from 'react-native-svg';
import { resolveCardMaterial, resolveCardTokens } from '@miscellary/shared';
import type {
  CardMaterial,
  CardRenderAssets,
  Gradient,
  Rarity,
  TemplateConfig,
} from '@miscellary/shared';

interface GradientGeometry {
  colors: readonly [string, string, ...string[]];
  locations: readonly [number, number, ...number[]];
  start: { x: number; y: number };
  end: { x: number; y: number };
}

// CSS angles start upward and run clockwise; Expo expects unit endpoints.
function gradientGeometry(gradient: Gradient, width: number, height: number): GradientGeometry {
  const radians = (gradient.angle * Math.PI) / 180;
  const dirX = Math.sin(radians);
  const dirY = -Math.cos(radians);
  const length = Math.abs(width * dirX) + Math.abs(height * dirY);
  const halfX = (length * dirX) / 2 / (width || 1);
  const halfY = (length * dirY) / 2 / (height || 1);
  const stops = gradient.stops.length > 1 ? gradient.stops : [...gradient.stops, ...gradient.stops];
  const rawLocations = stops.map((stop, index) => {
    if (stop.at !== undefined) return stop.at / 100;
    if (index === 0) return 0;
    if (index === stops.length - 1) return 1;
    return index / (stops.length - 1);
  });
  let highest = 0;
  const locations = rawLocations.map((value) => (highest = Math.max(highest, value)));

  return {
    colors: stops.map((stop) => stop.color) as unknown as GradientGeometry['colors'],
    locations: locations as unknown as GradientGeometry['locations'],
    start: { x: 0.5 - halfX, y: 0.5 - halfY },
    end: { x: 0.5 + halfX, y: 0.5 + halfY },
  };
}

function CardFinish({
  material,
  width,
  height,
}: {
  material: CardMaterial;
  width: number;
  height: number;
}) {
  return (
    <LinearGradient
      {...gradientGeometry(material.coat, width, height)}
      pointerEvents="none"
      style={{
        position: 'absolute',
        inset: 0,
        opacity: material.sheen,
        mixBlendMode: material.coatBlend as 'soft-light',
      }}
    />
  );
}

export default function BakedCard({
  render,
  title,
  rarity,
  templateKey,
  templateConfig,
  width,
  onError,
}: {
  render: CardRenderAssets;
  title: string;
  rarity: Rarity;
  templateKey: string;
  templateConfig: TemplateConfig;
  width: number;
  onError?: () => void;
}) {
  const rawId = useId();
  const id = rawId.replace(/[^a-z0-9]/gi, '');
  const height = width * 1.4;
  const image = render.thumbnail;
  const mask = render.mask_thumbnail;
  const material = resolveCardMaterial(templateKey, templateConfig, rarity);
  const tokens = resolveCardTokens(templateKey, templateConfig, rarity);
  const chase = material.chase;
  const corner = width * (tokens.corner / 100);
  if (!image) return null;
  const field = chase ? gradientGeometry(chase.field.sheet, width, height) : null;
  const band = chase ? gradientGeometry(chase.band.gradient, width, height) : null;

  return (
    <View
      style={[styles.card, { width, height, borderRadius: corner }]}
      accessible
      accessibilityRole="image"
      accessibilityLabel={title}
    >
      <Image
        source={{ uri: image.url }}
        resizeMode="stretch"
        accessibilityIgnoresInvertColors
        onError={onError}
        style={StyleSheet.absoluteFill}
      />
      <CardFinish material={material} width={width} height={height} />
      {chase && mask && field && band ? (
        <Svg width={width} height={height} pointerEvents="none" style={StyleSheet.absoluteFill}>
          <Defs>
            <Mask id={`${id}-mask`}>
              <SvgImage
                href={{ uri: mask.url }}
                x="0"
                y="0"
                width={width}
                height={height}
                preserveAspectRatio="none"
              />
            </Mask>
            <SvgLinearGradient
              id={`${id}-field`}
              x1={field.start.x}
              y1={field.start.y}
              x2={field.end.x}
              y2={field.end.y}
            >
              {chase.field.sheet.stops.map((stop, index) => (
                <Stop
                  key={`${stop.color}-${index}`}
                  offset={`${stop.at ?? (index / (chase.field.sheet.stops.length - 1)) * 100}%`}
                  stopColor={stop.color}
                />
              ))}
            </SvgLinearGradient>
            <SvgLinearGradient
              id={`${id}-band`}
              x1={band.start.x}
              y1={band.start.y}
              x2={band.end.x}
              y2={band.end.y}
            >
              {chase.band.gradient.stops.map((stop, index) => (
                <Stop
                  key={`${stop.color}-${index}`}
                  offset={`${stop.at ?? (index / (chase.band.gradient.stops.length - 1)) * 100}%`}
                  stopColor={stop.color}
                />
              ))}
            </SvgLinearGradient>
          </Defs>
          <Rect
            width={width}
            height={height}
            fill={`url(#${id}-field)`}
            opacity={chase.field.opacity}
            mask={`url(#${id}-mask)`}
          />
          <Rect
            width={width}
            height={height}
            fill={`url(#${id}-band)`}
            opacity={chase.band.opacity}
            mask={`url(#${id}-mask)`}
          />
        </Svg>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#efe7d6',
    boxShadow: [
      { offsetX: 0, offsetY: 1, blurRadius: 2, color: 'rgba(46, 33, 14, 0.22)' },
      { offsetX: 0, offsetY: 4, blurRadius: 8, color: 'rgba(46, 33, 14, 0.14)' },
    ],
  },
});

import type { ReactNode } from 'react';
import { View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { CardTokens } from '@miscellary/shared';
import { fade, gradientGeometry, share } from './geometry';

/* The edge paint covers the card; the stock is inset by its width. */
export default function CardSurface({
  tokens,
  width,
  height,
  children,
}: {
  tokens: CardTokens;
  width: number;
  height: number;
  children?: ReactNode;
}) {
  const edgeWidth = share(width, tokens.edgeWidth);
  const corner = share(width, tokens.corner);
  const inner = Math.max(corner - edgeWidth, 0);
  const core = tokens.core;

  return (
    <View
      style={{
        width,
        height,
        borderRadius: corner,
        isolation: 'isolate',
        boxShadow: [
          {
            offsetX: 0,
            offsetY: 0,
            blurRadius: 0,
            spreadDistance: share(width, 0.14),
            color: fade(core, 80),
          },
          {
            offsetX: 0,
            offsetY: share(width, 0.3),
            blurRadius: share(width, 0.5),
            color: 'rgba(46, 33, 14, 0.26)',
          },
          {
            offsetX: 0,
            offsetY: share(width, 1.4),
            blurRadius: share(width, 2.6),
            color: 'rgba(46, 33, 14, 0.18)',
          },
          {
            offsetX: 0,
            offsetY: share(width, 3),
            blurRadius: share(width, 5.5),
            color: tokens.glow ?? 'rgba(46, 33, 14, 0.1)',
          },
        ],
      }}
    >
      {tokens.edge.kind === 'gradient' ? (
        <LinearGradient
          {...gradientGeometry(tokens.edge, width, height)}
          style={{ position: 'absolute', inset: 0, borderRadius: corner }}
        />
      ) : (
        <View
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: corner,
            backgroundColor: tokens.edge.color,
          }}
        />
      )}

      <View
        style={{
          position: 'absolute',
          top: edgeWidth,
          left: edgeWidth,
          right: edgeWidth,
          bottom: edgeWidth,
          borderRadius: inner,
          backgroundColor: tokens.stock,
          overflow: 'hidden',
          boxShadow: [
            {
              offsetX: 0,
              offsetY: 0,
              blurRadius: 0,
              spreadDistance: share(width, 0.2),
              color: fade(core, 55),
              inset: true,
            },
            {
              offsetX: 0,
              offsetY: 0,
              blurRadius: share(width, 2.2),
              color: 'rgba(46, 33, 14, 0.08)',
              inset: true,
            },
            {
              offsetX: 0,
              offsetY: share(width, 0.4),
              blurRadius: 0,
              color: 'rgba(255, 252, 244, 0.3)',
              inset: true,
            },
          ],
        }}
      >
        {children}
      </View>
    </View>
  );
}

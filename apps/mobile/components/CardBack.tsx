import { useId } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, G, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { resolvePackColour } from '@miscellary/shared';
import { fonts } from '@/lib/theme';
import SetMark from './SetMark';
import linen from '../assets/tex-linen.png';

// Native gradients cannot use the web surface's CSS filter, so adjust each stop directly.
function tone(hue: number, saturation: number, brightness: number, s: number, l: number) {
  const h = (hue + 170 + 360) % 360;
  return `hsl(${h}, ${Math.min(100, s * saturation)}%, ${Math.min(100, l * brightness)}%)`;
}

function LinenLayer({
  width,
  height,
  opacity,
  blend,
}: {
  width: number;
  height: number;
  opacity: number;
  blend?: 'overlay';
}) {
  const tile = 88;
  const columns = Math.ceil(width / tile);
  const rows = Math.ceil(height / tile);

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity, mixBlendMode: blend }]}>
      {Array.from({ length: columns * rows }, (_, index) => (
        <Image
          key={index}
          source={linen}
          resizeMode="stretch"
          style={{
            position: 'absolute',
            left: (index % columns) * tile,
            top: Math.floor(index / columns) * tile,
            width: tile,
            height: tile,
          }}
        />
      ))}
    </View>
  );
}

function BackPattern({ width, height, mark }: { width: number; height: number; mark: string }) {
  const tile = width * 0.17;
  const patternWidth = width * 1.7;
  const patternHeight = height * 1.45;
  const columns = Math.ceil(patternWidth / tile);
  const rows = Math.ceil(patternHeight / tile);
  const marked = mark !== 'none';

  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: (width - patternWidth) / 2,
        top: (height - patternHeight) / 2,
        width: patternWidth,
        height: patternHeight,
        opacity: marked ? 0.32 : 0.28,
        transform: [{ rotate: marked ? '22deg' : '45deg' }],
      }}
    >
      {Array.from({ length: columns * rows }, (_, index) => {
        const left = (index % columns) * tile;
        const top = Math.floor(index / columns) * tile;
        return (
          <View
            key={index}
            style={{
              position: 'absolute',
              left,
              top,
              width: tile,
              height: tile,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {marked ? (
              <SetMark mark={mark} size={width * 0.072} color="#e8cd8a" strokeWidth={2.4} />
            ) : (
              <View
                style={{
                  width: width * 0.055,
                  height: width * 0.055,
                  borderWidth: width * 0.006,
                  borderColor: '#e8cd8a',
                  transform: [{ rotate: '45deg' }],
                }}
              />
            )}
          </View>
        );
      })}
    </View>
  );
}

function Pip({ left, top, width }: { left: number; top: number; width: number }) {
  const size = width * 0.028;
  return (
    <View
      style={{
        position: 'absolute',
        left: left - size / 2,
        top: top - size / 2,
        width: size,
        height: size,
        backgroundColor: 'rgba(226, 196, 116, 0.72)',
        transform: [{ rotate: '45deg' }],
      }}
    />
  );
}

export default function CardBack({
  width,
  title,
  mark = 'waves',
  packColour,
}: {
  width: number;
  title?: string;
  mark?: string;
  packColour?: string;
}) {
  const poolId = `${useId().replace(/:/g, '')}-pool`;
  const colour = resolvePackColour(packColour);
  const height = width * 1.4;
  const corner = width * 0.03;
  const hasMark = mark !== 'none';

  return (
    <View
      accessible
      accessibilityLabel={title ? `${title}, card back` : 'Miscellary card back'}
      style={{
        width,
        height,
        borderRadius: corner,
        boxShadow: [
          {
            offsetX: 0,
            offsetY: width * 0.03,
            blurRadius: width * 0.08,
            color: 'rgba(5, 20, 18, 0.5)',
          },
        ],
      }}
    >
      <View
        style={{
          flex: 1,
          borderRadius: corner,
          overflow: 'hidden',
          backgroundColor: '#143a35',
          boxShadow: [
            {
              offsetX: 0,
              offsetY: 0,
              blurRadius: 0,
              spreadDistance: 1,
              color: 'rgba(255, 255, 255, 0.07)',
              inset: true,
            },
          ],
        }}
      >
        <LinearGradient
          colors={[
            tone(colour.hue, colour.saturation, colour.brightness, 40, 24),
            tone(colour.hue, colour.saturation, colour.brightness, 39, 15),
            tone(colour.hue, colour.saturation, colour.brightness, 52, 12),
          ]}
          locations={[0, 0.55, 1]}
          start={{ x: 0.28, y: 0 }}
          end={{ x: 0.72, y: 1 }}
          style={StyleSheet.absoluteFill}
        />

        <LinenLayer width={width} height={height} opacity={0.18} />
        <LinenLayer width={width} height={height} opacity={0.37} blend="overlay" />

        <BackPattern width={width} height={height} mark={mark} />

        <Svg pointerEvents="none" width={width} height={height} style={StyleSheet.absoluteFill}>
          <Defs>
            <RadialGradient id={poolId} cx="50%" cy="45%" r="50%">
              <Stop offset="0%" stopColor="#e2c474" stopOpacity={0.22} />
              <Stop offset="100%" stopColor="#e2c474" stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect width={width} height={height} fill={`url(#${poolId})`} />
        </Svg>

        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: width * 0.05,
            top: width * 0.05,
            width: width * 0.9,
            height: height - width * 0.1,
            borderWidth: width * 0.011,
            borderColor: 'rgba(226, 196, 116, 0.62)',
            borderRadius: width * 0.04,
          }}
        />
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: width * 0.085,
            top: width * 0.085,
            width: width * 0.83,
            height: height - width * 0.17,
            borderWidth: width * 0.005,
            borderColor: 'rgba(226, 196, 116, 0.62)',
            borderRadius: width * 0.025,
          }}
        />
        <Pip left={width * 0.085} top={width * 0.085} width={width} />
        <Pip left={width * 0.915} top={width * 0.085} width={width} />
        <Pip left={width * 0.085} top={height - width * 0.085} width={width} />
        <Pip left={width * 0.915} top={height - width * 0.085} width={width} />

        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: width * 0.23,
            top: width * 0.36,
            width: width * 0.54,
            height: width * 0.54,
            borderRadius: width * 0.27,
            borderWidth: width * 0.009,
            borderColor: 'rgba(226, 196, 116, 0.62)',
          }}
        />
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: width * 0.265,
            top: width * 0.395,
            width: width * 0.47,
            height: width * 0.47,
            borderRadius: width * 0.235,
            borderWidth: width * 0.0045,
            borderColor: 'rgba(226, 196, 116, 0.62)',
          }}
        />

        {hasMark ? (
          <View
            pointerEvents="none"
            style={{ position: 'absolute', left: width * 0.314, top: width * 0.444 }}
          >
            <SetMark mark={mark} size={width * 0.372} color="#e6cb84" strokeWidth={1.15} />
          </View>
        ) : (
          <Svg
            pointerEvents="none"
            width={width * 0.461}
            height={width * 0.346}
            viewBox="0 0 64 48"
            style={{ position: 'absolute', left: width * 0.2696, top: width * 0.4572 }}
          >
            <G fill="none" stroke="#e6cb84" strokeWidth={1.6}>
              <Rect x={10} y={10} width={20} height={30} rx={2.5} transform="rotate(-16 20 25)" />
              <Rect x={34} y={10} width={20} height={30} rx={2.5} transform="rotate(16 44 25)" />
              <Rect x={22} y={6} width={20} height={32} rx={2.5} />
              <Path
                d="m32 15 1.9 4 4.3.5-3.2 2.9.9 4.3-3.9-2.2-3.9 2.2.9-4.3-3.2-2.9 4.3-.5Z"
                fill="#e6cb84"
                stroke="none"
              />
            </G>
          </Svg>
        )}

        {title ? (
          <Text
            numberOfLines={1}
            style={{
              position: 'absolute',
              top: width * 1.075,
              left: width * 0.1,
              width: width * 0.8,
              color: 'rgba(232, 212, 160, 0.82)',
              fontFamily: fonts.display,
              fontSize: width * 0.07,
              lineHeight: width * 0.075,
              letterSpacing: width * 0.0084,
              textAlign: 'center',
            }}
          >
            {title.length > 22 ? `${title.slice(0, 21)}…` : title}
          </Text>
        ) : null}
        <Text
          numberOfLines={1}
          style={{
            position: 'absolute',
            top: width * 1.205,
            left: width * 0.1,
            width: width * 0.8,
            color: 'rgba(226, 196, 116, 0.55)',
            fontFamily: fonts.body,
            fontSize: width * 0.036,
            lineHeight: width * 0.04,
            fontWeight: '700',
            letterSpacing: width * 0.015,
            textAlign: 'center',
          }}
        >
          MISCELLARY
        </Text>
      </View>
    </View>
  );
}

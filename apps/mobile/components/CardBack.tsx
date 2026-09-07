import { useId } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Defs, G, Path, Pattern, Rect, Text } from 'react-native-svg';
import { SET_MARK_PATHS } from '@miscellary/shared';
import { fonts } from '@/lib/theme';
import linen from '../assets/tex-linen.png';

const hues: Record<string, number> = {
  mint: 0,
  moss: -42,
  forest: -28,
  ocean: 54,
  sky: 38,
  indigo: 88,
  violet: 108,
  orchid: 148,
  rose: 168,
  crimson: 172,
  ember: -132,
  rust: -142,
  gold: -104,
  bronze: -112,
  sand: -96,
};

export default function CardBack({
  width,
  title,
  mark = 'waves',
  packColour = '',
}: {
  width: number;
  title: string;
  mark?: string;
  packColour?: string;
}) {
  const id = useId().replace(/:/g, '');
  const paths = mark === 'none' ? [] : (SET_MARK_PATHS[mark] ?? SET_MARK_PATHS.waves!);
  const hue = (170 + (hues[packColour] ?? 0) + 360) % 360;
  const saturation = ['white', 'silver', 'ash', 'slate', 'charcoal', 'black'].includes(packColour)
    ? 5
    : 40;
  return (
    <View
      accessible
      accessibilityLabel={`${title}, card back`}
      style={{
        width,
        height: width * 1.4,
        borderRadius: width * 0.03,
        overflow: 'hidden',
        backgroundColor: '#143a35',
      }}
    >
      <LinearGradient
        colors={[`hsl(${hue}, ${saturation}%, 24%)`, `hsl(${hue}, ${saturation}%, 12%)`]}
        style={StyleSheet.absoluteFill}
      />
      <Image
        source={linen}
        resizeMode="repeat"
        style={[StyleSheet.absoluteFill, { opacity: 0.16 }]}
      />
      <Svg width="100%" height="100%" viewBox="0 0 100 140">
        <Defs>
          <Pattern
            id={id}
            width={17}
            height={17}
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(22)"
          >
            <G scale={0.3} fill="none" stroke="#e8cd8a55" strokeWidth={2.4}>
              {paths.length ? (
                paths.map((d, i) => (d ? <Path key={i} d={d} /> : null))
              ) : (
                <Path d="M12 2 22 12 12 22 2 12Z" />
              )}
            </G>
          </Pattern>
        </Defs>
        <Rect width={100} height={140} fill={`url(#${id})`} />
        <G fill="none" stroke="#e2c4749e">
          <Rect x={5} y={5} width={90} height={130} rx={4} strokeWidth={1.1} />
          <Rect x={8.5} y={8.5} width={83} height={123} rx={2.5} strokeWidth={0.5} />
          <Circle cx={50} cy={63} r={27} strokeWidth={0.9} />
          <Circle cx={50} cy={63} r={23.5} strokeWidth={0.45} />
        </G>
        <G
          transform="translate(31.4 44.4) scale(1.55)"
          fill="none"
          stroke="#e6cb84"
          strokeWidth={1.15}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {paths.length ? (
            paths.map((d, i) => (d ? <Path key={i} d={d} /> : null))
          ) : (
            <>
              <Rect x={5} y={3} width={14} height={19} rx={2} />
              <Path d="M12 7 14 11 18 12 14 14 12 18 10 14 6 12 10 11Z" />
            </>
          )}
        </G>
        <Text
          x={50}
          y={115}
          textAnchor="middle"
          fill="#e8d4a0"
          fontFamily={fonts.display}
          fontSize={7}
        >
          {title.length > 22 ? `${title.slice(0, 21)}…` : title}
        </Text>
        <Text
          x={50}
          y={125}
          textAnchor="middle"
          fill="#e2c47488"
          fontFamily={fonts.body}
          fontSize={3.6}
          letterSpacing={1.5}
        >
          MISCELLARY
        </Text>
      </Svg>
    </View>
  );
}

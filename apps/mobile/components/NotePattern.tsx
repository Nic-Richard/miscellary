import { useId } from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Circle, Defs, Path, Pattern, Rect } from 'react-native-svg';

export default function NotePattern({ paper, scale }: { paper?: string; scale: number }) {
  const id = useId().replace(/:/g, '');
  if (!['ruled', 'grid', 'dot'].includes(paper ?? '')) return null;
  const size = 6.5 * scale;
  return (
    <Svg pointerEvents="none" width="100%" height="100%" style={StyleSheet.absoluteFill}>
      <Defs>
        <Pattern id={id} width={size} height={size} patternUnits="userSpaceOnUse">
          {paper === 'dot' ? (
            <Circle cx={size / 2} cy={size / 2} r={0.3 * scale} fill="#60849255" />
          ) : (
            <Path
              d={`M 0 ${size} H ${size}${paper === 'grid' ? ` M ${size} 0 V ${size}` : ''}`}
              stroke="#60849233"
              strokeWidth={0.25 * scale}
            />
          )}
        </Pattern>
      </Defs>
      <Rect width="100%" height="100%" fill={`url(#${id})`} />
    </Svg>
  );
}

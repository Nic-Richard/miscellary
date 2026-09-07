import { SET_MARK_PATHS } from '@miscellary/shared';
import Svg, { Path } from 'react-native-svg';

export default function SetMark({
  mark = 'waves',
  size,
  color,
}: {
  mark?: string;
  size: number;
  color: string;
}) {
  if (mark === 'none') return null;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {(SET_MARK_PATHS[mark] ?? SET_MARK_PATHS.waves!).map((path, i) =>
        path ? (
          <Path
            key={i}
            d={path}
            fill="none"
            stroke={color}
            strokeWidth={1.6}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : null,
      )}
    </Svg>
  );
}

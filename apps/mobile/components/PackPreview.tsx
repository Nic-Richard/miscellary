import type { CardSetSummary } from '@miscellary/shared';
import SharedSurface from './SharedSurface';

export default function PackPreview({ set, width = 180 }: { set: CardSetSummary; width?: number }) {
  return (
    <SharedSurface mode="pack" data={{ set }} width={width} height={(width * 908) / 545} passive />
  );
}

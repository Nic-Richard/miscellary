import type { CardSetSummary } from '@miscellary/shared';
import { Image, View } from 'react-native';
import SharedSurface from './SharedSurface';

export default function PackPreview({ set, width = 180 }: { set: CardSetSummary; width?: number }) {
  const image = set.render_pack?.image;
  const height =
    set.status === 'draft'
      ? (width * 908) / 545
      : (width * (image?.height ?? 800)) / (image?.width ?? 640);

  if (set.status === 'draft')
    return <SharedSurface mode="pack" data={{ set }} width={width} height={height} passive />;

  if (image) {
    return <Image source={{ uri: image.url }} style={{ width, height }} resizeMode="contain" />;
  }

  return <View style={{ width, height }} />;
}

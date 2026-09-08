import type { Rarity, TemplateConfig } from '@miscellary/shared';
import NativeCardPreview from './card/CardPreview';
import SharedSurface from './SharedSurface';

export type CardRenderer = 'web' | 'native';

interface Props {
  title: string;
  rarity: Rarity;
  description?: string;
  imageUrl: string | null;
  templateKey: string;
  templateConfig: TemplateConfig;
  width?: number;
  number?: number;
  mark?: string;
  renderer?: CardRenderer;
}

export default function CardPreview({
  width = 160,
  description = '',
  renderer = 'native',
  ...data
}: Props) {
  if (renderer === 'native') {
    return <NativeCardPreview {...data} description={description} width={width} />;
  }

  return (
    <SharedSurface
      mode="card"
      data={{ description, ...data }}
      width={width}
      height={width * 1.4}
      passive
    />
  );
}

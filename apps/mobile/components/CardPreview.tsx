import type { Rarity, TemplateConfig } from '@miscellary/shared';
import SharedSurface from './SharedSurface';

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
}

export default function CardPreview({ width = 160, ...data }: Props) {
  return (
    <SharedSurface
      mode="card"
      data={{ description: '', ...data }}
      width={width}
      height={width * 1.4}
      passive
    />
  );
}

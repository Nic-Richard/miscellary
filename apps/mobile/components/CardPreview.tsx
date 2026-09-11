import { resolveCardTokens } from '@miscellary/shared';
import type { CardRenderAssets, Rarity, TemplateConfig } from '@miscellary/shared';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import BakedCard from './BakedCard';
import SharedSurface from './SharedSurface';

interface Props {
  title: string;
  rarity: Rarity;
  description?: string;
  printedText?: string;
  imageUrl: string | null;
  templateKey: string;
  templateConfig: TemplateConfig;
  width?: number;
  code?: string;
  mark?: string;
  render?: CardRenderAssets | null | undefined;
}

export default function CardPreview({
  width = 160,
  description = '',
  printedText = '',
  render,
  ...data
}: Props) {
  const [failed, setFailed] = useState(false);
  const source = render?.thumbnail?.url;
  useEffect(() => setFailed(false), [source]);

  if (render && source && !failed) {
    return (
      <BakedCard
        render={render}
        title={data.title}
        rarity={data.rarity}
        templateKey={data.templateKey}
        templateConfig={data.templateConfig}
        width={width}
        onError={() => setFailed(true)}
      />
    );
  }
  if (!render)
    return (
      <SharedSurface
        mode="card"
        data={{ description, printedText, ...data }}
        width={width}
        height={width * 1.4}
        passive
      />
    );

  const tokens = resolveCardTokens(data.templateKey, data.templateConfig, data.rarity);
  return (
    <View
      accessibilityLabel={`${data.title} render pending`}
      accessibilityRole="image"
      style={[
        styles.pending,
        {
          width,
          height: width * 1.4,
          borderRadius: width * (tokens.corner / 100),
          backgroundColor: tokens.stock,
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  pending: { opacity: 0.72, overflow: 'hidden' },
});

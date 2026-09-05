import { RARITY_LABELS } from '@miscellary/shared';
import type { Rarity, TemplateConfig } from '@miscellary/shared';
import { Image, StyleSheet, Text, View } from 'react-native';
import { accentColors, colors, rarityColors } from '@/lib/theme';
import Description from './Description';

interface CardPreviewProps {
  title: string;
  rarity: Rarity;
  description?: string;
  imageUrl: string | null;
  templateKey: string;
  templateConfig: TemplateConfig;
  width?: number;
}

export default function CardPreview({
  title,
  rarity,
  description = '',
  imageUrl,
  templateKey,
  templateConfig,
  width = 160,
}: CardPreviewProps) {
  const rc = rarityColors[rarity] ?? colors.muted;
  const ac = accentColors[templateConfig.accent ?? ''] ?? colors.gold;
  const height = (width * 7) / 5;
  const small = width < 200;

  const light =
    templateKey === 'polaroid' || (templateKey === 'classic' && templateConfig.frame === 'light');
  const frameBg = templateKey === 'polaroid' ? '#fbfaf7' : light ? '#f3f0e8' : colors.sur;
  const textColor = light ? '#1c1c1c' : colors.text;
  const descColor = light ? '#555' : colors.muted;

  const art = (
    <View style={[styles.art, artStyle(templateKey, templateConfig, ac)]}>
      {imageUrl ? (
        <Image source={{ uri: imageUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      ) : (
        <Text style={styles.placeholder}>No image yet</Text>
      )}
      {templateKey === 'polaroid' && templateConfig.tint !== 'none' ? (
        <View
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor:
                templateConfig.tint === 'warm'
                  ? 'rgba(255,190,120,0.25)'
                  : 'rgba(120,170,255,0.25)',
            },
          ]}
        />
      ) : null}
    </View>
  );

  const body = (
    <View style={[styles.body, templateKey === 'minimal' && styles.minimalBody]}>
      <View
        style={[
          styles.titleRow,
          templateKey === 'classic' && {
            borderBottomColor: ac,
            borderBottomWidth: 2,
            paddingBottom: 3,
          },
        ]}
      >
        <Text
          numberOfLines={1}
          style={[
            styles.title,
            {
              color: templateKey === 'minimal' ? ac : templateKey === 'bold' ? rc : textColor,
              fontSize: small ? 13 : 16,
            },
            templateKey === 'bold' && { textTransform: 'uppercase', letterSpacing: 0.5 },
            templateKey === 'polaroid' && { fontStyle: 'italic', fontWeight: '400' },
          ]}
        >
          {title || 'Untitled'}
        </Text>
        <Text style={[styles.rarity, { color: rc }]}>{RARITY_LABELS[rarity]}</Text>
      </View>
      {!small && description ? (
        <Description
          text={description}
          color={templateKey === 'minimal' ? 'rgba(255,255,255,0.8)' : descColor}
        />
      ) : null}
    </View>
  );

  return (
    <View
      style={[
        styles.card,
        {
          width,
          height,
          borderColor: rc,
          backgroundColor: frameBg,
          borderWidth: templateKey === 'bold' ? 5 : small ? 2 : 3,
        },
        templateKey === 'bold' && { borderRadius: 16 },
        templateKey === 'polaroid' && { borderColor: '#e6e2d8', borderRadius: 4 },
        rarity === 'legendary' && {
          shadowColor: rc,
          shadowOpacity: 0.7,
          shadowRadius: 12,
          elevation: 8,
        },
      ]}
    >
      {templateKey === 'minimal' ? (
        <>
          <View style={StyleSheet.absoluteFill}>{art}</View>
          <View
            style={{
              flex: 1,
              justifyContent: templateConfig.gradient === 'top' ? 'flex-start' : 'flex-end',
            }}
          >
            {body}
          </View>
        </>
      ) : (
        <>
          {art}
          {body}
        </>
      )}
    </View>
  );
}

function artStyle(templateKey: string, config: TemplateConfig, accent: string) {
  switch (templateKey) {
    case 'classic':
      return { margin: 8, marginBottom: 0, borderWidth: 2, borderColor: accent, borderRadius: 5 };
    case 'polaroid':
      return { margin: 10, marginBottom: 0 };
    case 'bold':
      return {
        margin: 8,
        marginBottom: 0,
        borderRadius: config.shape === 'circle' ? 999 : config.shape === 'arch' ? 80 : 8,
        aspectRatio: config.shape === 'circle' ? 1 : undefined,
        flex: config.shape === 'circle' ? 0 : 1,
      };
    default:
      return {};
  }
}

const styles = StyleSheet.create({
  card: { borderRadius: 10, overflow: 'hidden' },
  art: {
    flex: 1,
    backgroundColor: '#000',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholder: { color: colors.faint, fontSize: 12 },
  body: { padding: 8, gap: 4 },
  minimalBody: { backgroundColor: 'rgba(0,0,0,0.65)' },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: 6,
  },
  title: { fontWeight: '700', flexShrink: 1 },
  rarity: { fontSize: 9, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
});

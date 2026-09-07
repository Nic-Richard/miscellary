import { useState } from 'react';
import { Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { captionFrom, resolveCardMaterial, resolveCardTokens, restOf } from '@miscellary/shared';
import type { Rarity, TemplateConfig } from '@miscellary/shared';
import Description from '@/components/Description';
import SetMark from '@/components/SetMark';
import CardChase from './CardChaseLayer';
import { CardFinish, CardRelief, CardVarnish } from './CardFinishLayer';
import CardPanel from './CardPanel';
import CardSurface from './CardSurface';
import { CardGrain, CardTexture } from './CardTextureLayer';
import CardWindow from './CardWindow';
import type { WindowShape } from './CardWindow';
import { CARD_RATIO, fade, share } from './geometry';

export interface CardPreviewProps {
  title: string;
  rarity: Rarity;
  description: string;
  imageUrl: string | null;
  templateKey: string;
  templateConfig: TemplateConfig;
  width: number;
  number?: number;
  caption?: string;
  mark?: string | undefined;

  light?: number;
}

const TEXT_TEMPLATES = new Set(['fieldnote', 'dossier']);

const FACES: Record<string, string> = {
  display: 'BebasNeue',
  body: 'RobotoCondensed',
  playfair: 'PlayfairDisplay',
  cinzel: 'Cinzel',
  archivo: 'ArchivoBlack',
  spacemono: 'SpaceMono',
  caveat: 'Caveat',
  alfa: 'AlfaSlabOne',
};

const LARGE_FROM = 200;

export default function CardPreview({
  title,
  rarity,
  description,
  imageUrl,
  templateKey,
  templateConfig,
  width,
  number,
  caption,
  mark,
  light = 1,
}: CardPreviewProps) {
  const tokens = resolveCardTokens(templateKey, templateConfig, rarity);
  const material = resolveCardMaterial(templateKey, templateConfig, rarity);
  const height = width * CARD_RATIO;
  const s = (value: number) => share(width, value);
  const [art, setArt] = useState({ width: 0, height: 0 });

  const shownTitle = title || 'Untitled';
  const isText = TEXT_TEMPLATES.has(templateKey);
  const minimal = templateKey === 'minimal';
  const line = templateKey === 'polaroid' ? shownTitle : (caption ?? captionFrom(description));
  const body = caption === undefined ? restOf(description) : description;
  const chase = templateConfig.treatment === 'foil' || templateConfig.treatment === 'holo';
  const coverage = templateConfig.coverage ?? 'art';
  const face = FACES[templateConfig.font ?? 'display'] ?? FACES.display!;
  const shape = (templateConfig.shape ?? 'square') as WindowShape;
  const large = width >= LARGE_FROM;
  const gradient = templateConfig.gradient ?? 'bottom';

  const windowWidth =
    templateConfig.window === 'none' ||
    templateConfig.window === 'inset' ||
    templateKey === 'polaroid'
      ? 0
      : templateConfig.window === 'mat'
        ? s(2.8)
        : s(0.6);
  const windowColour =
    templateConfig.window === 'mat'
      ? tokens.core
      : templateKey === 'classic'
        ? tokens.accent
        : '#bfb29a';
  const artRadius = minimal
    ? 0
    : templateKey === 'polaroid'
      ? s(0.6)
      : templateKey === 'bold'
        ? s(2)
        : s(1.5);
  const centred = shape === 'circle' || shape === 'diamond';

  const headMin = templateKey === 'polaroid' ? s(8) : templateKey === 'bold' ? s(10) : s(12);
  const headPad = templateKey === 'polaroid' ? s(1.5) : s(2.5);

  const artNode = (
    <View
      onLayout={(event) => setArt(event.nativeEvent.layout)}
      collapsable={false}
      style={
        minimal
          ? { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }
          : centred
            ? { width: width * 0.74, aspectRatio: 1, alignSelf: 'center', marginTop: s(1) }
            : isText
              ? { flexBasis: '47%', flexGrow: 0, flexShrink: 0, minHeight: 0 }
              : { flex: 1, minHeight: 0 }
      }
    >
      <CardWindow
        shape={minimal ? 'square' : shape}
        imageUrl={imageUrl}
        radius={artRadius}
        base={s(2)}
        border={minimal ? 0 : windowWidth}
        borderColour={windowColour}
        background={templateKey === 'classic' ? tokens.artBg : '#d9d0be'}
        clipId={`art-${templateKey}-${shape}-${Math.round(width)}`}
      />
      {material.varnish && art.width > 0 ? (
        <CardVarnish width={art.width} height={art.height} light={light} />
      ) : null}
      {chase && coverage === 'art' && art.width > 0 ? (
        <CardChase chase={material.chase} width={art.width} height={art.height} light={light} />
      ) : null}
    </View>
  );

  const head = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: s(3),
        minHeight: headMin,
        paddingBottom: headPad,
        paddingTop: minimal ? s(4) : 0,
        paddingHorizontal: minimal ? s(5) : 0,
        borderBottomWidth: templateKey === 'classic' ? 1 : 0,
        borderBottomColor: fade(tokens.ink, 18),
      }}
    >
      {number ? (
        <Text
          style={{
            fontFamily: face,
            fontSize: templateKey === 'polaroid' ? s(7) : s(10.5),
            lineHeight: templateKey === 'polaroid' ? s(7) : s(10.5),
            letterSpacing: s(10.5) * 0.04,
            color:
              templateKey === 'polaroid'
                ? tokens.inkMuted
                : templateKey === 'bold'
                  ? tokens.border
                  : tokens.ink,
          }}
        >
          {String(number).padStart(3, '0')}
        </Text>
      ) : null}
      {templateKey === 'polaroid' || templateKey === 'bold' ? (
        <View style={{ flex: 1 }} />
      ) : (
        <Text
          numberOfLines={1}
          style={{
            flex: 1,
            fontFamily: face,
            fontSize: s(5.6),
            letterSpacing: s(5.6) * 0.1,
            textTransform: 'uppercase',
            color: tokens.ink,
          }}
        >
          {shownTitle}
        </Text>
      )}
      <SetMark mark={mark ?? 'waves'} size={s(9)} color={minimal ? tokens.ink : tokens.accent} />
    </View>
  );

  const foot =
    templateKey === 'bold' || (!isText && line) ? (
      <View
        style={{
          flexDirection: templateKey === 'polaroid' ? 'row' : 'column',
          alignItems: templateKey === 'polaroid' ? 'baseline' : 'center',
          justifyContent: templateKey === 'polaroid' ? 'space-between' : undefined,
          gap: templateKey === 'bold' ? s(3) : s(2.4),
          minHeight: templateKey === 'polaroid' ? s(22) : undefined,
          marginTop: minimal ? 'auto' : undefined,
          paddingTop: minimal
            ? s(16)
            : templateKey === 'polaroid'
              ? s(5)
              : templateKey === 'bold'
                ? s(3.5)
                : isText
                  ? s(2.6)
                  : s(4),
          paddingBottom: minimal ? s(5) : templateKey === 'polaroid' ? s(3) : isText ? 0 : s(1.5),
          paddingHorizontal: minimal ? s(5) : s(1),
        }}
      >
        {templateKey === 'bold' ? (
          <Text
            numberOfLines={1}
            style={{
              fontFamily: face,
              fontSize: s(9.5),
              lineHeight: s(9.5),
              letterSpacing: s(9.5) * 0.04,
              textTransform: 'uppercase',
              color: tokens.rarity,
            }}
          >
            {shownTitle}
          </Text>
        ) : null}
        {!isText && line ? (
          <Text
            numberOfLines={templateKey === 'polaroid' ? 2 : 1}
            style={{
              flex: templateKey === 'polaroid' ? 1 : undefined,
              fontSize:
                templateKey === 'polaroid' ? s(8.2) : templateKey === 'bold' ? s(5) : s(5.6),
              lineHeight: templateKey === 'polaroid' ? s(8.2) * 1.05 : undefined,
              fontStyle: templateKey === 'polaroid' ? 'italic' : 'normal',
              fontWeight: templateKey === 'polaroid' ? '600' : '400',
              textAlign: templateKey === 'polaroid' ? 'left' : 'center',
              color: minimal
                ? tokens.accent
                : templateKey === 'bold'
                  ? tokens.inkMuted
                  : tokens.ink,
            }}
          >
            {line}
          </Text>
        ) : null}
      </View>
    ) : null;

  const desc =
    !isText && large && body ? (
      <View
        style={{
          maxHeight: s(18),
          marginTop: s(1),
          overflow: 'hidden',
          paddingHorizontal: minimal ? s(5) : 0,
          paddingBottom: minimal ? s(4) : 0,
          backgroundColor: minimal ? 'rgba(12, 14, 12, 0.85)' : undefined,
        }}
      >
        <Description text={body} color={tokens.inkMuted} fontSize={s(5)} fixedScale />
      </View>
    ) : null;

  return (
    <View style={{ width, height }}>
      <CardSurface tokens={tokens} width={width} height={height}>
        {minimal ? null : <CardTexture texture={tokens.texture} width={width} height={height} />}
        {minimal ? artNode : null}
        {minimal && gradient === 'full' ? (
          <LinearGradient
            colors={['rgba(18, 22, 24, 0.5)', 'rgba(18, 22, 24, 0.22)', 'rgba(18, 22, 24, 0.62)']}
            locations={[0, 0.45, 1]}
            style={{ position: 'absolute', inset: 0 }}
          />
        ) : null}

        <View style={{ flex: 1, padding: minimal ? 0 : s(4) }}>
          {minimal && gradient === 'top' ? (
            <LinearGradient
              colors={['rgba(12, 14, 12, 0.85)', 'rgba(12, 14, 12, 0)']}
              style={{ position: 'absolute', top: 0, left: 0, right: 0, height: s(30) }}
            />
          ) : null}
          {head}
          {minimal ? null : artNode}
          {isText ? (
            <CardPanel
              templateKey={templateKey}
              paper={templateConfig.paper ?? 'plain'}
              tokens={tokens}
              cardWidth={width}
              patternId={`paper-${templateKey}-${Math.round(width)}`}
            >
              {description ? (
                <Description text={description} color={tokens.ink} fontSize={s(5)} fixedScale />
              ) : (
                <Text style={{ fontSize: s(5), fontStyle: 'italic', color: tokens.inkMuted }}>
                  No description yet
                </Text>
              )}
            </CardPanel>
          ) : null}
          {minimal && gradient === 'bottom' ? (
            <LinearGradient
              colors={['rgba(12, 14, 12, 0)', 'rgba(12, 14, 12, 0.85)']}
              style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: s(38) }}
            />
          ) : null}
          {foot}
          {desc}
        </View>

        <CardFinish material={material} width={width} height={height} light={light} />
        {chase && coverage !== 'art' ? (
          <CardChase chase={material.chase} width={width} height={height} light={light} />
        ) : null}
        <CardRelief material={material} width={width} corner={share(width, tokens.corner)} />
      </CardSurface>
      <CardGrain
        opacity={material.grain}
        width={width}
        height={height}
        corner={share(width, tokens.corner)}
      />
    </View>
  );
}

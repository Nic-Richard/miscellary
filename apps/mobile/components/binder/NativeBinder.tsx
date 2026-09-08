import { useId, useState } from 'react';
import type { Card } from '@miscellary/shared';
import { resolveBinderColour } from '@miscellary/shared';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { fonts } from '@/lib/theme';
import CardPreview from '@/components/card/CardPreview';
import SetMark from '@/components/SetMark';
import binder from '../../assets/binder.png';
import binderCloth from '../../assets/binder-cloth.png';

const BINDER_RATIO = 1028 / 625;
const COLUMNS = [5.18, 26.39, 55.57, 76.78];
const ROWS = [2.92, 49.48];
const SLOT_WIDTH = 19.7;

const SLOTS = ROWS.flatMap((top, row) =>
  COLUMNS.map((left, column) => ({
    position: row * 4 + column,
    left,
    top,
    column,
    row,
  })),
);

function EmptySlot({ width, number, mark }: { width: number; number: number; mark?: string }) {
  return (
    <View
      style={{
        width,
        height: width * 1.4,
        padding: width * 0.06,
        alignItems: 'center',
        backgroundColor: '#efe8da',
        borderRadius: Math.max(2, width * 0.02),
        borderWidth: Math.max(1, width * 0.012),
        borderColor: 'rgba(148, 132, 104, 0.35)',
      }}
    >
      <Text
        style={{
          alignSelf: 'flex-start',
          color: '#a3967f',
          fontFamily: fonts.display,
          fontSize: width * 0.1,
          lineHeight: width * 0.1,
          letterSpacing: width * 0.005,
        }}
      >
        {String(number).padStart(3, '0')}
      </Text>
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <SetMark mark={mark} size={width * 0.38} color="#c0b39a" strokeWidth={1.1} />
      </View>
    </View>
  );
}

function BinderLight({ width, height }: { width: number; height: number }) {
  const id = useId().replace(/:/g, '');
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { mixBlendMode: 'soft-light' }]}>
      <Svg width={width} height={height}>
        <Defs>
          <RadialGradient id={`${id}-key`} cx="26%" cy="8%" rx="74%" ry="92%">
            <Stop offset="0%" stopColor="#fff9e8" stopOpacity={0.78} />
            <Stop offset="70%" stopColor="#fff9e8" stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id={`${id}-shade`} cx="80%" cy="108%" rx="118%" ry="132%">
            <Stop offset="0%" stopColor="#2c1e0a" stopOpacity={0.52} />
            <Stop offset="62%" stopColor="#2c1e0a" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect width={width} height={height} fill={`url(#${id}-key)`} />
        <Rect width={width} height={height} fill={`url(#${id}-shade)`} />
      </Svg>
    </View>
  );
}

export default function NativeBinder({
  cards,
  page,
  half,
  mark,
  colour,
  viewportWidth,
  onInspect,
  marks,
  onPickEmpty,
  onRemove,
}: {
  cards: Array<Card | null | undefined>;
  page: number;
  half: boolean;
  mark?: string;
  colour?: string;
  viewportWidth?: number;
  onInspect: (id: string, index: number) => void;
  marks?: Array<string | undefined>;
  onPickEmpty?: (index: number) => void;
  onRemove?: (index: number) => void;
}) {
  const [measuredWidth, setMeasuredWidth] = useState(0);
  const visibleWidth = viewportWidth ?? measuredWidth;
  const fullWidth = half ? visibleWidth * 2 : visibleWidth;
  const fullHeight = fullWidth / BINDER_RATIO;
  const spread = Math.floor(page / 2);
  const rightPage = half && page % 2 === 1;
  const cloth = resolveBinderColour(colour);
  const artworkFrame = {
    position: 'absolute' as const,
    left: 0,
    top: 0,
    width: fullWidth,
    height: fullHeight,
  };

  return (
    <View
      onLayout={
        viewportWidth === undefined
          ? (event) => setMeasuredWidth(event.nativeEvent.layout.width)
          : undefined
      }
      style={{
        width: '100%',
        aspectRatio: half ? BINDER_RATIO / 2 : BINDER_RATIO,
        overflow: 'hidden',
      }}
    >
      {visibleWidth > 0 ? (
        <View
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: fullWidth,
            height: fullHeight,
            transform: [{ translateX: rightPage ? -visibleWidth : 0 }],
          }}
        >
          <Image source={binder} resizeMode="stretch" style={artworkFrame} />
          <View
            pointerEvents="none"
            style={[
              artworkFrame,
              {
                filter: [
                  { hueRotate: `${cloth.hue}deg` },
                  { saturate: cloth.saturation },
                  { brightness: cloth.brightness },
                ],
              },
            ]}
          >
            <Image
              source={binderCloth}
              resizeMode="stretch"
              style={{ width: fullWidth, height: fullHeight }}
            />
          </View>
          <BinderLight width={fullWidth} height={fullHeight} />

          {SLOTS.map((slot) => {
            if (half && slot.column >= 2 !== rightPage) return null;
            const index =
              spread * 8 + (slot.column >= 2 ? 4 : 0) + slot.row * 2 + (slot.column % 2);
            const card = cards[index];
            const cardWidth = (fullWidth * SLOT_WIDTH) / 100;
            const slotMark = marks?.[index] ?? mark;
            return (
              <View
                key={slot.position}
                style={{
                  position: 'absolute',
                  left: (fullWidth * slot.left) / 100,
                  top: (fullHeight * slot.top) / 100,
                  width: cardWidth,
                  height: cardWidth * 1.4,
                  boxShadow: [
                    {
                      offsetX: fullWidth * 0.001,
                      offsetY: fullWidth * 0.003,
                      blurRadius: fullWidth * 0.004,
                      color: 'rgba(50, 36, 18, 0.32)',
                    },
                  ],
                }}
              >
                <Pressable
                  accessibilityRole={card || onPickEmpty ? 'button' : undefined}
                  accessibilityLabel={
                    card
                      ? `${onPickEmpty ? 'Change' : 'Inspect'} ${card.title}`
                      : `Choose a card for slot ${index + 1}`
                  }
                  disabled={!card && !onPickEmpty}
                  onPress={
                    card
                      ? () => onInspect(card.id, index)
                      : onPickEmpty
                        ? () => onPickEmpty(index)
                        : undefined
                  }
                  style={({ pressed }) => ({
                    width: cardWidth,
                    height: cardWidth * 1.4,
                    opacity: pressed ? 0.78 : 1,
                  })}
                >
                  {card ? (
                    <CardPreview
                      title={card.title}
                      rarity={card.rarity}
                      description={card.description}
                      imageUrl={card.image.url}
                      templateKey={card.template_key}
                      templateConfig={card.template_config}
                      number={card.position + 1}
                      mark={slotMark}
                      width={cardWidth}
                    />
                  ) : (
                    <EmptySlot width={cardWidth} number={index + 1} mark={slotMark} />
                  )}
                </Pressable>
                {card && onRemove ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${card.title} from slot ${index + 1}`}
                    hitSlop={6}
                    onPress={() => onRemove(index)}
                    style={({ pressed }) => ({
                      position: 'absolute',
                      top: cardWidth * 0.03,
                      right: cardWidth * 0.03,
                      zIndex: 3,
                      width: Math.max(22, cardWidth * 0.16),
                      height: Math.max(22, cardWidth * 0.16),
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: 999,
                      borderWidth: 1,
                      borderColor: 'rgba(255, 255, 255, 0.72)',
                      backgroundColor: pressed ? '#7e3933' : 'rgba(45, 35, 26, 0.88)',
                    })}
                  >
                    <Text
                      style={{
                        color: '#fffaf0',
                        fontFamily: fonts.body,
                        fontSize: Math.max(15, cardWidth * 0.11),
                        lineHeight: Math.max(17, cardWidth * 0.13),
                      }}
                    >
                      ×
                    </Text>
                  </Pressable>
                ) : null}
                <View
                  pointerEvents="none"
                  style={{
                    position: 'absolute',
                    inset: -cardWidth * 0.02,
                    borderRadius: Math.max(3, cardWidth * 0.025),
                    borderTopWidth: Math.max(1, cardWidth * 0.015),
                    borderLeftWidth: Math.max(1, cardWidth * 0.006),
                    borderColor: 'rgba(255, 255, 255, 0.22)',
                  }}
                />
              </View>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

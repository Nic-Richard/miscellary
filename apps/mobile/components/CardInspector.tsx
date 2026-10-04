import { useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { resolveCardTokens } from '@miscellary/shared';
import type { Card, Creator } from '@miscellary/shared';

import { Animated, Image, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import SharedSurface from './SharedSurface';

export default function CardInspector({
  card,
  setTitle,
  setSlug,
  mark,
  packColour,
  creator,
  copies,
  actions,
  onClose,
}: {
  card: Card;
  setTitle: string;
  setSlug: string;
  mark?: string;
  packColour?: string;
  creator?: Creator;
  copies?: number;
  actions?: ReactNode;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const screen = useWindowDimensions();
  const fade = useRef(new Animated.Value(1)).current;
  const move = useRef(new Animated.ValueXY()).current;
  const scale = useRef(new Animated.Value(1)).current;
  const [loading, setLoading] = useState(true);
  const still = card.render?.flat_thumbnail?.url;
  // Near where the inspector draws the card on a phone; once drawn, the still moves onto the card.
  const width = Math.min(screen.width * 0.74, 280, ((screen.height - 240) * 5) / 7);
  const height = (width * 7) / 5;
  const top = Math.max(insets.top, (screen.height - height - 250) / 2 + 24);
  const left = (screen.width - width) / 2;
  const corner = still
    ? width * (resolveCardTokens(card.template_key, card.template_config, card.rarity).corner / 100)
    : 0;
  function reveal(stage?: { x: number; y: number; width: number; height: number }) {
    const settle = stage
      ? Animated.parallel([
          Animated.timing(move, {
            toValue: {
              x: stage.x + stage.width / 2 - (left + width / 2),
              y: stage.y + stage.height / 2 - (top + height / 2),
            },
            duration: 160,
            useNativeDriver: true,
          }),
          Animated.timing(scale, {
            toValue: stage.width / width,
            duration: 160,
            useNativeDriver: true,
          }),
        ])
      : Animated.delay(0);
    Animated.sequence([
      settle,
      Animated.delay(120),
      Animated.timing(fade, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start(() => setLoading(false));
  }
  return (
    <View style={styles.web}>
      <SharedSurface
        mode="inspect"
        data={{ card, setTitle, setSlug, mark, packColour, creator, copies }}
        onEvent={(type, data) => {
          if (type === 'close') onClose();
          if (type === 'drawn' && loading)
            reveal(data as { x: number; y: number; width: number; height: number } | undefined);
        }}
      />
      {still && loading && screen.height > screen.width ? (
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left,
            top,
            opacity: fade,
            transform: [...move.getTranslateTransform(), { scale }],
          }}
        >
          <Image
            source={{ uri: still }}
            resizeMode="stretch"
            style={{ width, height, borderRadius: corner }}
          />
        </Animated.View>
      ) : null}
      {actions ? (
        <View style={[styles.webActions, { bottom: insets.bottom + 14 }]}>{actions}</View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  web: { flex: 1, backgroundColor: '#241d16' },
  webActions: { position: 'absolute', right: 14 },
});

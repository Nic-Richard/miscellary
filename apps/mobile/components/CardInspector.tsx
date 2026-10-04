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
  const [loading, setLoading] = useState(true);
  const still = card.render?.flat_thumbnail?.url;
  // Where the inspector draws the card on a phone, so the still sits under it until it appears.
  const width = Math.min(screen.width * 0.74, 280, ((screen.height - 240) * 5) / 7);
  const height = (width * 7) / 5;
  const corner = still
    ? width * (resolveCardTokens(card.template_key, card.template_config, card.rarity).corner / 100)
    : 0;
  return (
    <View style={styles.web}>
      <SharedSurface
        mode="inspect"
        data={{ card, setTitle, setSlug, mark, packColour, creator, copies }}
        onReady={() =>
          setTimeout(
            () =>
              Animated.timing(fade, { toValue: 0, duration: 180, useNativeDriver: true }).start(
                () => setLoading(false),
              ),
            250,
          )
        }
        onEvent={(type) => {
          if (type === 'close') onClose();
        }}
      />
      {still && loading && screen.height > screen.width ? (
        <Animated.View pointerEvents="none" style={[styles.still, { opacity: fade }]}>
          <Image
            source={{ uri: still }}
            resizeMode="stretch"
            style={{
              width,
              height,
              borderRadius: corner,
              marginTop: Math.max(insets.top, (screen.height - height - 250) / 2 + 24),
            }}
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
  still: { ...StyleSheet.absoluteFillObject, alignItems: 'center' },
});

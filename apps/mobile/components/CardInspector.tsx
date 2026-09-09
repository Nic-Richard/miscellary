import type { ReactNode } from 'react';
import type { Card, Creator } from '@miscellary/shared';
import { StyleSheet, View } from 'react-native';
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
  return (
    <View style={styles.web}>
      <SharedSurface
        mode="inspect"
        data={{ card, setTitle, setSlug, mark, packColour, creator, copies }}
        onEvent={(type) => {
          if (type === 'close') onClose();
        }}
      />
      {actions ? <View style={styles.webActions}>{actions}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  web: { flex: 1, backgroundColor: '#241d16' },
  webActions: { position: 'absolute', right: 14, bottom: 14 },
});

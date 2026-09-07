import type { PackOpening } from '@miscellary/shared';
import { Modal, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import SharedSurface from './SharedSurface';

export default function PackReveal({
  opening,
  onClose,
}: {
  opening: PackOpening;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible onRequestClose={onClose} supportedOrientations={['portrait', 'landscape']}>
      <View
        style={{
          flex: 1,
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
          backgroundColor: '#241d16',
        }}
      >
        <SharedSurface
          mode="reveal"
          data={{ opening }}
          onEvent={(type) => {
            if (type === 'close') onClose();
          }}
        />
      </View>
    </Modal>
  );
}

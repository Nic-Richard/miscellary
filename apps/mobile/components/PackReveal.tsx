import type { PackOpening } from '@miscellary/shared';
import { StatusBar } from 'expo-status-bar';
import { Modal, View } from 'react-native';
import SharedSurface from './SharedSurface';

export default function PackReveal({
  opening,
  onClose,
}: {
  opening: PackOpening;
  onClose: () => void;
}) {
  return (
    <Modal
      visible
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
      supportedOrientations={['portrait', 'landscape']}
    >
      <StatusBar style="light" backgroundColor="#103832" translucent />
      <View
        style={{
          flex: 1,
          backgroundColor: '#103832',
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

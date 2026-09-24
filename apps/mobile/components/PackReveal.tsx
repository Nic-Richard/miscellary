import type { PackOpening } from '@miscellary/shared';
import { View } from 'react-native';
import InspectorModal from './InspectorModal';
import SharedSurface from './SharedSurface';

export default function PackReveal({
  opening,
  onClose,
}: {
  opening: PackOpening;
  onClose: () => void;
}) {
  return (
    <InspectorModal open onClose={onClose}>
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
    </InspectorModal>
  );
}

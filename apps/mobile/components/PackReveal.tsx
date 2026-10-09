import type { PackOpening } from '@miscellary/shared';
import { View } from 'react-native';
import { useColors } from '@/lib/theme';
import InspectorModal from './InspectorModal';
import SharedSurface from './SharedSurface';

export default function PackReveal({
  opening,
  onClose,
}: {
  opening: PackOpening;
  onClose: () => void;
}) {
  const colors = useColors();
  return (
    <InspectorModal open onClose={onClose}>
      <View
        style={{
          flex: 1,
          backgroundColor: colors.revealBg,
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

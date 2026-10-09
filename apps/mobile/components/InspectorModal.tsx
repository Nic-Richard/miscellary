import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Modal, StatusBar } from 'react-native';
import { contrast } from '@miscellary/shared';
import { useColors } from '@/lib/theme';

// An Android modal is its own window and copies the status bar style when it opens,
// so the light style is set first and the modal opens a frame later.
export default function InspectorModal({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const [shown, setShown] = useState(false);
  const colors = useColors();
  const barStyle = contrast('#ffffff', colors.bg) >= 4.5 ? 'light-content' : 'dark-content';

  useEffect(() => {
    if (!open) {
      setShown(false);
      return;
    }
    StatusBar.setBarStyle('light-content', false);
    const frame = requestAnimationFrame(() => setShown(true));
    return () => {
      cancelAnimationFrame(frame);
      StatusBar.setBarStyle(barStyle, false);
    };
  }, [open, barStyle]);

  return (
    <Modal
      visible={shown}
      statusBarTranslucent
      navigationBarTranslucent
      supportedOrientations={['portrait', 'landscape']}
      onRequestClose={onClose}
    >
      {children}
    </Modal>
  );
}

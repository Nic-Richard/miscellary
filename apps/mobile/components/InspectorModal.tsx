import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Modal, StatusBar } from 'react-native';

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

  useEffect(() => {
    if (!open) {
      setShown(false);
      return;
    }
    StatusBar.setBarStyle('light-content', false);
    const frame = requestAnimationFrame(() => setShown(true));
    return () => {
      cancelAnimationFrame(frame);
      StatusBar.setBarStyle('dark-content', false);
    };
  }, [open]);

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

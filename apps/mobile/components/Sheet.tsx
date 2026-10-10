import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createThemedStyles, fonts } from '@/lib/theme';

/** A bottom sheet for free-form content, drawn like ChoiceSheet. */
export default function Sheet({
  visible,
  title,
  onClose,
  footer,
  children,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  footer?: ReactNode;
  children: ReactNode;
}) {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView behavior="padding" style={styles.fill}>
        <Pressable style={styles.scrim} onPress={onClose} accessibilityLabel="Close" />
        <View style={[styles.sheet, { paddingBottom: 16 + insets.bottom }]}>
          <View style={styles.grip} />
          <Text accessibilityRole="header" style={styles.title}>
            {title}
          </Text>
          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>
          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const useStyles = createThemedStyles((colors) => ({
  fill: { flex: 1, justifyContent: 'flex-end' },
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(40,30,16,0.38)' },
  sheet: {
    maxHeight: '90%',
    backgroundColor: colors.bg,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderTopWidth: 1,
    borderColor: colors.bdr2,
    paddingHorizontal: 18,
    paddingTop: 10,
  },
  grip: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.bdr2,
    marginBottom: 14,
  },
  title: { color: colors.pageText, fontFamily: fonts.display, fontSize: 28, letterSpacing: 0.5 },
  body: { marginTop: 12, flexShrink: 1 },
  bodyContent: { gap: 10, paddingBottom: 6 },
  footer: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingTop: 12 },
}));

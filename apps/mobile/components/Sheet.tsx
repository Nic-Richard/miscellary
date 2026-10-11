import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createThemedStyles, fonts } from '@/lib/theme';

/** A bottom sheet that closes with a swipe down, a tap outside or back. */
export default function Sheet({
  visible,
  title,
  onClose,
  header,
  footer,
  children,
}: {
  visible: boolean;
  title?: string;
  onClose: () => void;
  /** Shown under the grip instead of a plain title. */
  header?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}) {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const drag = useRef(new Animated.Value(0)).current;
  const close = useRef(onClose);
  close.current = onClose;
  const atTop = useRef(true);
  useEffect(() => {
    if (!visible) return;
    drag.setValue(0);
    atTop.current = true;
  }, [visible, drag]);
  // A downward drag closes the sheet unless its content is scrolled and should scroll back first.
  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponderCapture: (_, g) =>
        atTop.current && g.dy > 8 && Math.abs(g.dy) > Math.abs(g.dx) * 1.5,
      onPanResponderMove: (_, g) => drag.setValue(Math.max(0, g.dy)),
      onPanResponderRelease: (_, g) => {
        if (g.dy > 90 || g.vy > 0.9) close.current();
        else Animated.spring(drag, { toValue: 0, useNativeDriver: true }).start();
      },
      onPanResponderTerminate: () =>
        Animated.spring(drag, { toValue: 0, useNativeDriver: true }).start(),
    }),
  ).current;
  return (
    // Drawn under the system bars so the sheet reaches the screen edge on Android;
    // the inset padding keeps its buttons clear of the gesture bar.
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
        <Animated.View
          {...pan.panHandlers}
          style={[
            styles.sheet,
            { paddingBottom: 16 + insets.bottom, transform: [{ translateY: drag }] },
          ]}
        >
          <View style={styles.handle}>
            <View style={styles.grip} />
            {header ??
              (title ? (
                <Text accessibilityRole="header" style={styles.title}>
                  {title}
                </Text>
              ) : null)}
          </View>
          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            keyboardShouldPersistTaps="handled"
            scrollEventThrottle={16}
            onScroll={(event) => {
              atTop.current = event.nativeEvent.contentOffset.y <= 0;
            }}
          >
            {children}
          </ScrollView>
          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </Animated.View>
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
  },
  handle: { paddingTop: 10, paddingBottom: 4 },
  grip: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.bdr2,
    marginBottom: 14,
  },
  title: { color: colors.pageText, fontFamily: fonts.display, fontSize: 28, letterSpacing: 0.5 },
  body: { marginTop: 10, flexShrink: 1 },
  bodyContent: { gap: 10, paddingBottom: 6 },
  footer: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingTop: 12 },
}));

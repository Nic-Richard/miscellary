import Feather from '@expo/vector-icons/Feather';
import { Fragment, useEffect, useRef } from 'react';
import {
  Animated,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts, useColors, createThemedStyles } from '@/lib/theme';

export interface SheetChoice<T extends string> {
  value: T;
  label: string;
  note?: string;
  icon: keyof typeof Feather.glyphMap;
  group?: string;
  swatches?: readonly string[];
  selected?: boolean;
}

export default function ChoiceSheet<T extends string>({
  visible,
  title,
  choices,
  onChoose,
  onClose,
}: {
  visible: boolean;
  title: string;
  choices: SheetChoice<T>[];
  onChoose: (value: T) => void;
  onClose: () => void;
}) {
  const colors = useColors();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const drag = useRef(new Animated.Value(0)).current;
  const scrollable = choices.length > 6;
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    if (visible) drag.setValue(0);
  }, [visible, drag]);
  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dy > 6 && Math.abs(g.dy) > Math.abs(g.dx),
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
      <View style={styles.fill}>
        <Pressable style={styles.scrim} onPress={onClose} accessibilityLabel="Close" />
        <Animated.View
          {...(scrollable ? {} : pan.panHandlers)}
          style={[
            styles.sheet,
            { paddingBottom: 24 + insets.bottom, transform: [{ translateY: drag }] },
          ]}
        >
          <View {...(scrollable ? pan.panHandlers : {})}>
            <View style={styles.grip} />
            <Text accessibilityRole="header" style={styles.title}>
              {title}
            </Text>
          </View>
          <ScrollView style={styles.list} contentContainerStyle={styles.choices}>
            {choices.map((choice, index) => (
              <Fragment key={choice.value}>
                {choice.group && choice.group !== choices[index - 1]?.group && (
                  <Text accessibilityRole="header" style={styles.group}>
                    {choice.group}
                  </Text>
                )}
                <Pressable
                  accessibilityRole={choice.swatches ? 'radio' : 'button'}
                  accessibilityState={choice.swatches ? { checked: !!choice.selected } : {}}
                  accessibilityLabel={choice.label}
                  accessibilityHint={choice.note}
                  onPress={() => onChoose(choice.value)}
                  style={({ pressed }) => [styles.choice, pressed && styles.choicePressed]}
                >
                  {choice.swatches ? (
                    <View
                      style={styles.swatches}
                      accessibilityElementsHidden
                      importantForAccessibility="no-hide-descendants"
                    >
                      {choice.swatches.map((color, index) => (
                        <View
                          key={index}
                          style={{ backgroundColor: color, width: 12, height: 24 }}
                        />
                      ))}
                    </View>
                  ) : (
                    <View style={styles.badge}>
                      <Feather name={choice.icon} size={19} color={colors.accent} />
                    </View>
                  )}
                  <View style={styles.words}>
                    <Text style={styles.label}>{choice.label}</Text>
                    {choice.note ? <Text style={styles.note}>{choice.note}</Text> : null}
                  </View>
                  {choice.swatches ? (
                    <View style={{ width: 18 }}>
                      {choice.selected && <Feather name="check" size={18} color={colors.accent} />}
                    </View>
                  ) : (
                    <Feather name="chevron-right" size={18} color={colors.faint} />
                  )}
                </Pressable>
              </Fragment>
            ))}
          </ScrollView>
          <Pressable
            accessibilityRole="button"
            onPress={onClose}
            style={({ pressed }) => [styles.cancel, pressed && { opacity: 0.7 }]}
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </Animated.View>
      </View>
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
  list: { marginTop: 14, flexShrink: 1 },
  choices: { gap: 10 },
  group: { color: colors.pageMuted, fontFamily: fonts.medium, fontSize: 14, marginTop: 8 },
  swatches: {
    flexDirection: 'row',
    overflow: 'hidden',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.bdr2,
  },
  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    minHeight: 64,
    paddingHorizontal: 14,
    backgroundColor: colors.sur,
    borderWidth: 1,
    borderColor: colors.bdr,
    borderRadius: 10,
  },
  choicePressed: { backgroundColor: colors.sur2, borderColor: colors.accent },
  badge: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: colors.sur2,
  },
  words: { flex: 1, gap: 2 },
  label: { color: colors.text, fontFamily: fonts.medium, fontSize: 16 },
  note: { color: colors.muted, fontFamily: fonts.body, fontSize: 14 },
  cancel: { alignSelf: 'center', marginTop: 16, padding: 8 },
  cancelText: {
    color: colors.pageMuted,
    fontFamily: fonts.medium,
    fontSize: 16,
  },
}));

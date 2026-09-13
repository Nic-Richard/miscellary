import Feather from '@expo/vector-icons/Feather';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '@/lib/theme';

export interface SheetChoice<T extends string> {
  value: T;
  label: string;
  note?: string;
  icon: keyof typeof Feather.glyphMap;
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
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.fill}>
        <Pressable style={styles.scrim} onPress={onClose} accessibilityLabel="Close" />
        <View style={styles.sheet}>
          <View style={styles.grip} />
          <Text accessibilityRole="header" style={styles.title}>
            {title}
          </Text>
          <View style={styles.choices}>
            {choices.map((choice) => (
              <Pressable
                key={choice.value}
                accessibilityRole="button"
                accessibilityLabel={choice.label}
                accessibilityHint={choice.note}
                onPress={() => onChoose(choice.value)}
                style={({ pressed }) => [styles.choice, pressed && styles.choicePressed]}
              >
                <View style={styles.badge}>
                  <Feather name={choice.icon} size={19} color={colors.accent} />
                </View>
                <View style={styles.words}>
                  <Text style={styles.label}>{choice.label}</Text>
                  {choice.note ? <Text style={styles.note}>{choice.note}</Text> : null}
                </View>
                <Feather name="chevron-right" size={18} color={colors.faint} />
              </Pressable>
            ))}
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={onClose}
            style={({ pressed }) => [styles.cancel, pressed && { opacity: 0.7 }]}
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, justifyContent: 'flex-end' },
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(40,30,16,0.38)' },
  sheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderTopWidth: 1,
    borderColor: colors.bdr2,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 30,
  },
  grip: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.bdr2,
    marginBottom: 14,
  },
  title: { color: colors.text, fontFamily: fonts.display, fontSize: 28, letterSpacing: 0.5 },
  choices: { marginTop: 14, gap: 10 },
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
  choicePressed: { backgroundColor: 'rgba(30,110,103,0.07)', borderColor: colors.accent },
  badge: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: 'rgba(30,110,103,0.1)',
  },
  words: { flex: 1, gap: 2 },
  label: { color: colors.text, fontFamily: fonts.medium, fontSize: 16 },
  note: { color: colors.muted, fontFamily: fonts.body, fontSize: 13 },
  cancel: { alignSelf: 'center', marginTop: 16, padding: 8 },
  cancelText: {
    color: colors.muted,
    fontFamily: fonts.medium,
    fontSize: 13,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
});

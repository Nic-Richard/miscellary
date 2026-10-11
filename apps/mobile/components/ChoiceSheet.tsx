import Feather from '@expo/vector-icons/Feather';
import { Fragment } from 'react';
import { Pressable, Text, View } from 'react-native';
import { fonts, useColors, createThemedStyles } from '@/lib/theme';
import Sheet from './Sheet';

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
  header,
}: {
  visible: boolean;
  title: string;
  /** Shown above the choices in place of the title. */
  header?: React.ReactNode;
  choices: SheetChoice<T>[];
  onChoose: (value: T) => void;
  onClose: () => void;
}) {
  const colors = useColors();
  const styles = useStyles();
  return (
    <Sheet
      visible={visible}
      title={title}
      header={header}
      onClose={onClose}
      footer={
        <Pressable
          accessibilityRole="button"
          onPress={onClose}
          style={({ pressed }) => [styles.cancel, pressed && { opacity: 0.7 }]}
        >
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
      }
    >
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
                {choice.swatches.map((color, swatch) => (
                  <View key={swatch} style={{ backgroundColor: color, width: 12, height: 24 }} />
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
    </Sheet>
  );
}

const useStyles = createThemedStyles((colors) => ({
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
  cancel: { flex: 1, alignItems: 'center', padding: 8 },
  cancelText: {
    color: colors.pageMuted,
    fontFamily: fonts.medium,
    fontSize: 16,
  },
}));

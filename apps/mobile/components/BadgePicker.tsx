import { Pressable, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { BadgeColour, BadgeFinish, Creator } from '@miscellary/shared';
import { BADGE_COLOURS, BADGE_FINISHES } from '@miscellary/shared';
import { createThemedStyles, fonts, useColors } from '@/lib/theme';
import Avatar, { metalStops } from './Avatar';
import SupporterBadge from './SupporterBadge';
import { Segmented } from './ui';

export default function BadgePicker({
  person,
  colour,
  finish,
  disabled,
  onChange,
}: {
  person: Creator;
  colour: BadgeColour;
  finish: BadgeFinish;
  disabled: boolean;
  onChange: (change: { badge_colour?: BadgeColour; badge_finish?: BadgeFinish }) => void;
}) {
  const colors = useColors();
  const styles = useStyles();
  const style = `${colour}-${finish}`;
  return (
    <View style={styles.picker}>
      <View style={styles.preview} importantForAccessibility="no-hide-descendants">
        <Avatar person={person} badge={style} size={40} />
        <SupporterBadge badge={style} />
      </View>
      <Text style={styles.label}>Colour</Text>
      <View
        style={styles.swatches}
        accessibilityRole="radiogroup"
        accessibilityLabel="Badge colour"
      >
        {BADGE_COLOURS.map((item) => {
          const on = colour === item.id;
          return (
            <Pressable
              key={item.id}
              accessibilityRole="radio"
              accessibilityLabel={item.label}
              accessibilityState={{ checked: on, disabled }}
              disabled={disabled}
              hitSlop={4}
              onPress={() => onChange({ badge_colour: item.id })}
              style={[styles.swatchRing, on && { borderColor: colors.text }]}
            >
              <LinearGradient
                colors={metalStops(`${item.id}-${finish}`)}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.swatch}
              />
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.label}>Finish</Text>
      <Segmented
        label="Badge finish"
        options={BADGE_FINISHES.map((item) => ({ value: item.id, label: item.label }))}
        value={finish}
        onChange={(value) => {
          if (!disabled) onChange({ badge_finish: value });
        }}
      />
    </View>
  );
}

const useStyles = createThemedStyles((colors) => ({
  picker: {
    gap: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.bdr,
    backgroundColor: colors.sur2,
  },
  preview: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 4 },
  label: { color: colors.text, fontFamily: fonts.medium, fontSize: 14 },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  swatchRing: {
    padding: 2,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  swatch: { width: 28, height: 28, borderRadius: 14 },
}));

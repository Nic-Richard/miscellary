import { router } from 'expo-router';
import { Text } from 'react-native';
import type { StyleProp, TextStyle } from 'react-native';
import { fonts, useColors } from '@/lib/theme';

const MENTION = /(?<![\w@])(@[a-z0-9_]{3,20})\b/gi;

export default function RichText({ text, style }: { text: string; style?: StyleProp<TextStyle> }) {
  const colors = useColors();
  const parts = text.split(MENTION);
  return (
    <Text style={style}>
      {parts.map((part, index) =>
        index % 2 === 1 ? (
          <Text
            key={index}
            accessibilityRole="link"
            onPress={() => router.push(`/users/${part.slice(1).toLowerCase()}`)}
            style={{ color: colors.accentInk, fontFamily: fonts.medium }}
          >
            {part}
          </Text>
        ) : (
          part
        ),
      )}
    </Text>
  );
}

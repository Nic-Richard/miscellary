import { parseDescription } from '@miscellary/shared';
import type { DescriptionNode } from '@miscellary/shared';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '@/lib/theme';

function Inline({
  nodes,
  color,
  fontSize,
  fixedScale,
}: {
  nodes: DescriptionNode[];
  color: string;
  fontSize: number;
  fixedScale: boolean;
}) {
  return (
    <Text
      allowFontScaling={!fixedScale}
      style={{ color, fontSize, lineHeight: fontSize * 1.4, flexShrink: 1 }}
    >
      {nodes.map((n, i) => {
        if (n.type === 'bold')
          return (
            <Text key={i} style={{ fontWeight: '700' }}>
              {n.value}
            </Text>
          );
        if (n.type === 'italic')
          return (
            <Text key={i} style={{ fontStyle: 'italic' }}>
              {n.value}
            </Text>
          );
        if (n.type === 'break') return '\n';
        return n.value;
      })}
    </Text>
  );
}

export default function Description({
  text,
  color = colors.muted,
  fontSize = 13,
  fixedScale = false,
}: {
  text: string;
  color?: string;
  fontSize?: number;
  fixedScale?: boolean;
}) {
  return (
    <View style={styles.root}>
      {parseDescription(text).map((block, i) =>
        block.type === 'list' ? (
          <View key={i}>
            {block.items.map((item, j) => (
              <View key={j} style={styles.bullet}>
                <Text
                  allowFontScaling={!fixedScale}
                  style={{ color, fontSize, lineHeight: fontSize * 1.4 }}
                >
                  •{' '}
                </Text>
                <Inline nodes={item} color={color} fontSize={fontSize} fixedScale={fixedScale} />
              </View>
            ))}
          </View>
        ) : (
          <Inline
            key={i}
            nodes={block.children}
            color={color}
            fontSize={fontSize}
            fixedScale={fixedScale}
          />
        ),
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 4 },
  bullet: { flexDirection: 'row', paddingLeft: 4 },
});

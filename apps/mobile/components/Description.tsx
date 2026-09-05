import { parseDescription } from '@miscellary/shared';
import type { DescriptionNode } from '@miscellary/shared';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '@/lib/theme';

function Inline({ nodes, color }: { nodes: DescriptionNode[]; color: string }) {
  return (
    <Text style={{ color, fontSize: 13, lineHeight: 18 }}>
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
}: {
  text: string;
  color?: string;
}) {
  return (
    <View style={styles.root}>
      {parseDescription(text).map((block, i) =>
        block.type === 'list' ? (
          <View key={i}>
            {block.items.map((item, j) => (
              <View key={j} style={styles.bullet}>
                <Text style={{ color }}>• </Text>
                <Inline nodes={item} color={color} />
              </View>
            ))}
          </View>
        ) : (
          <Inline key={i} nodes={block.children} color={color} />
        ),
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 4 },
  bullet: { flexDirection: 'row', paddingLeft: 4 },
});

import type { PackOpening } from '@miscellary/shared';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, rarityColors } from '@/lib/theme';
import CardPreview from './CardPreview';
import { Button } from './ui';

export default function PackReveal({
  opening,
  onClose,
}: {
  opening: PackOpening;
  onClose: () => void;
}) {
  const [revealed, setRevealed] = useState(0);
  const total = opening.cards.length;

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        <View style={styles.header}>
          <Text style={{ color: colors.muted }}>
            {opening.kind === 'free' ? 'Daily pack' : 'Extra pack'} · {opening.card_set.title}
          </Text>
          <Text style={{ color: colors.faint }}>
            {revealed < total ? `${revealed}/${total}` : 'All revealed'}
          </Text>
        </View>
        <ScrollView contentContainerStyle={styles.grid}>
          {opening.cards.map((owned, i) => (
            <Pressable
              key={owned.id}
              onPress={() => i === revealed && setRevealed(revealed + 1)}
              style={styles.slot}
            >
              {i < revealed ? (
                <>
                  <View
                    style={
                      owned.card.rarity !== 'common'
                        ? {
                            shadowColor: rarityColors[owned.card.rarity],
                            shadowOpacity: 0.8,
                            shadowRadius: 14,
                            elevation: 10,
                          }
                        : null
                    }
                  >
                    <CardPreview
                      width={150}
                      title={owned.card.title}
                      rarity={owned.card.rarity}
                      imageUrl={owned.card.image.url}
                      templateKey={owned.card.template_key}
                      templateConfig={owned.card.template_config}
                    />
                  </View>
                  <Text
                    style={{
                      color: owned.copies > 1 ? colors.faint : colors.green,
                      fontSize: 11,
                      marginTop: 4,
                    }}
                  >
                    {owned.copies > 1 ? `Duplicate ×${owned.copies}` : 'New!'}
                  </Text>
                </>
              ) : (
                <View style={[styles.back, i === revealed && { borderColor: colors.accent }]}>
                  <Text style={{ color: colors.faint, fontSize: 28 }}>?</Text>
                  {i === revealed ? (
                    <Text style={{ color: colors.accent, fontSize: 11 }}>Tap to reveal</Text>
                  ) : null}
                </View>
              )}
            </Pressable>
          ))}
        </ScrollView>
        <View style={styles.actions}>
          {revealed < total ? (
            <Button title="Reveal all" kind="secondary" onPress={() => setRevealed(total)} />
          ) : null}
          <Button title="Done" onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#05080c', padding: 16, paddingTop: 48 },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'center',
    paddingBottom: 24,
  },
  slot: { alignItems: 'center', width: 150 },
  back: {
    width: 150,
    height: 210,
    borderRadius: 8,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.bdr2,
    backgroundColor: colors.sur,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  actions: { flexDirection: 'row', gap: 10, justifyContent: 'center', paddingVertical: 12 },
});

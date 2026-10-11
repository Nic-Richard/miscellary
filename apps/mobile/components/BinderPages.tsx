import type { Card, CardSetDetail } from '@miscellary/shared';
import { useState } from 'react';
import { Pressable, Text, View, useWindowDimensions } from 'react-native';
import { createThemedStyles, fonts } from '@/lib/theme';
import InspectorModal from './InspectorModal';
import SharedSurface from './SharedSurface';
import BinderDetails from './BinderDetails';
import BinderViewer from './BinderViewer';
import CardInspector from './CardInspector';
import InspectorActions from './InspectorActions';
import { Button } from './ui';

export default function BinderPages({
  cards,
  set,
  likedIds,
  onLike,
}: {
  cards: Card[];
  likedIds: string[];
  onLike?: (id: string) => void;
  set: CardSetDetail;
}) {
  const styles = useStyles();
  const { width, height } = useWindowDimensions();
  const rail = width > height && width >= 800;
  const [open, setOpen] = useState(false);
  const [spread, setSpread] = useState(0);
  const [selected, setSelected] = useState<Card | null>(null);
  const pages = Math.max(2, Math.ceil(cards.length / 8) * 2);
  const spreads = pages / 2;
  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: rail ? 'row' : 'column', gap: 12 }}>
        <View style={[styles.cover, rail && { flex: 1 }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open binder"
            onPress={() => setOpen(true)}
            style={({ pressed }) => [styles.preview, { opacity: pressed ? 0.85 : 1 }]}
          >
            <SharedSurface
              mode="binder"
              data={{ set: { ...set, cards }, page: spread * 2, half: false }}
              autoHeight
              passive
            />
          </Pressable>
          <View style={styles.pager}>
            <Button
              title="Previous"
              kind="quiet"
              small
              disabled={spread === 0}
              onPress={() => setSpread(spread - 1)}
            />
            <Text style={styles.pageLabel}>
              Pages {spread * 2 + 1} and {spread * 2 + 2} of {pages}
            </Text>
            <Button
              title="Next"
              kind="quiet"
              small
              disabled={spread >= spreads - 1}
              onPress={() => setSpread(spread + 1)}
            />
          </View>
          <Button title="Open binder" kind="secondary" onPress={() => setOpen(true)} />
        </View>
        {rail ? (
          <View style={{ width: 240 }}>
            <BinderDetails
              set={set}
              inspect={(id) => setSelected(cards.find((card) => card.id === id) ?? null)}
            />
          </View>
        ) : null}
      </View>
      {open ? (
        <BinderViewer
          title={set.title}
          subtitle={`${cards.length} cards`}
          spreads={spreads}
          start={spread}
          surface={(spread) => ({
            mode: 'binder',
            data: { set: { ...set, cards }, page: spread * 2, half: false, fill: true },
          })}
          spreadOf={(page) => Math.floor(page / 2)}
          onClose={() => setOpen(false)}
          onInspect={(id) => setSelected(cards.find((card) => card.id === id) ?? null)}
        />
      ) : null}
      {selected ? (
        <InspectorModal open onClose={() => setSelected(null)}>
          <View
            style={{
              flex: 1,
              backgroundColor: '#241d16',
            }}
          >
            <CardInspector
              card={selected}
              setTitle={set.title}
              setSlug={set.slug}
              mark={set.mark}
              packColour={set.pack_colour}
              creator={set.creator}
              onClose={() => setSelected(null)}
              actions={
                <InspectorActions
                  card={selected}
                  set={set}
                  liked={likedIds.includes(selected.id)}
                  likeCount={cards.find((entry) => entry.id === selected.id)?.like_count ?? 0}
                  onLike={onLike ? () => onLike(selected.id) : undefined}
                />
              }
            />
          </View>
        </InspectorModal>
      ) : null}
    </View>
  );
}

const useStyles = createThemedStyles((colors) => ({
  cover: { gap: 10 },
  preview: { borderRadius: 10, overflow: 'hidden' },
  pager: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  pageLabel: { color: colors.muted, fontFamily: fonts.medium, fontSize: 14 },
}));

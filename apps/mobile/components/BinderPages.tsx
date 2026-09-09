import type { Card, CardSetDetail } from '@miscellary/shared';
import { useState } from 'react';
import { Modal, Pressable, Text, View, useWindowDimensions } from 'react-native';
import SharedSurface from './SharedSurface';
import BinderDetails from './BinderDetails';
import CardInspector from './CardInspector';
import { Button, Muted } from './ui';

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
  const { width, height } = useWindowDimensions();
  const landscape = width > height;
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Card | null>(null);
  const pages = Math.max(2, Math.ceil(cards.length / 8) * 2);
  const first = landscape ? Math.floor(page / 2) * 2 : page;
  const rail = landscape && width >= 800;
  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: rail ? 'row' : 'column', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <SharedSurface
            mode="binder"
            data={{ set: { ...set, cards }, page: first, half: !landscape }}
            autoHeight
            onEvent={(type, id) => {
              if (type === 'inspect') setSelected(cards.find((card) => card.id === id) ?? null);
              if (type === 'page' && typeof id === 'number') {
                setPage(Math.max(0, Math.min(pages - (landscape ? 2 : 1), id)));
              }
            }}
          />
          <View
            style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
          >
            <Button
              title="Previous"
              kind="secondary"
              disabled={first === 0}
              onPress={() => setPage(Math.max(0, first - (landscape ? 2 : 1)))}
            />
            <Muted>
              {first + 1}
              {landscape ? `–${first + 2}` : ''} / {pages}
            </Muted>
            <Button
              title="Next"
              kind="secondary"
              disabled={first + (landscape ? 2 : 1) >= pages}
              onPress={() => setPage(first + (landscape ? 2 : 1))}
            />
          </View>
        </View>
        <View style={{ width: rail ? 240 : '100%' }}>
          <BinderDetails
            set={set}
            inspect={(id) => setSelected(cards.find((card) => card.id === id) ?? null)}
          />
        </View>
      </View>
      {selected ? (
        <Modal
          visible
          statusBarTranslucent
          navigationBarTranslucent
          supportedOrientations={['portrait', 'landscape']}
          onRequestClose={() => setSelected(null)}
        >
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
                onLike ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={
                      likedIds.includes(selected.id) ? 'Unlike card' : 'Like card'
                    }
                    hitSlop={8}
                    onPress={() => onLike(selected.id)}
                    style={({ pressed }) => ({
                      width: 40,
                      height: 40,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: 20,
                      borderWidth: 1,
                      borderColor: likedIds.includes(selected.id)
                        ? 'rgba(213, 109, 100, 0.72)'
                        : 'rgba(247, 241, 227, 0.24)',
                      backgroundColor: 'rgba(30, 24, 17, 0.76)',
                      opacity: pressed ? 0.62 : 1,
                    })}
                  >
                    <Text
                      style={{
                        color: likedIds.includes(selected.id)
                          ? '#d56d64'
                          : 'rgba(247, 241, 227, 0.7)',
                        fontSize: 19,
                        lineHeight: 21,
                      }}
                    >
                      ♥
                    </Text>
                  </Pressable>
                ) : null
              }
            />
          </View>
        </Modal>
      ) : null}
    </View>
  );
}

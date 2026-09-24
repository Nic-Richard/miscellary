import type { Card, CardSetDetail } from '@miscellary/shared';
import { useState } from 'react';
import { View, useWindowDimensions } from 'react-native';
import InspectorModal from './InspectorModal';
import SharedSurface from './SharedSurface';
import BinderDetails from './BinderDetails';
import CardInspector from './CardInspector';
import InspectorActions from './InspectorActions';
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

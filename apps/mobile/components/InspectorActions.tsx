import { cardPath } from '@miscellary/shared';
import type { Card, CardSetDetail } from '@miscellary/shared';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import ActionChip from '@/components/ActionChip';
import MoreButton from '@/components/MoreButton';
import ReportSheet from '@/components/ReportSheet';
import ShareButton from '@/components/ShareButton';
import { useAuth } from '@/lib/auth';

export default function InspectorActions({
  card,
  set,
  liked,
  likeCount,
  onLike,
}: {
  card: Card;
  set: CardSetDetail;
  liked: boolean;
  likeCount: number;
  onLike?: (() => void) | undefined;
}) {
  const { user } = useAuth();
  const [reporting, setReporting] = useState(false);
  if (set.status !== 'published') return null;
  const canReport = Boolean(user) && user?.profile.username !== set.creator.username;

  return (
    <View style={styles.row}>
      {onLike ? (
        <ActionChip
          dark
          icon="heart"
          count={likeCount}
          tone={liked ? 'liked' : 'plain'}
          accessibilityLabel={`${liked ? 'Unlike' : 'Like'} ${card.title}`}
          onPress={onLike}
        />
      ) : null}
      <ShareButton dark path={cardPath(set.slug, card.position)} title={card.title} />
      <MoreButton
        dark
        title={card.title}
        items={
          canReport
            ? [{ label: 'Report this card', icon: 'flag', onSelect: () => setReporting(true) }]
            : []
        }
      />
      <ReportSheet
        visible={reporting}
        subject={`“${card.title}”`}
        target={{ card_id: card.id }}
        onClose={() => setReporting(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
});

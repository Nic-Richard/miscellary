import { View } from 'react-native';
import type { PublishingAllowance } from '@miscellary/shared';
import { Muted } from './ui';

export default function PublishingNotice({ allowance }: { allowance: PublishingAllowance }) {
  if (!allowance.enabled) return null;
  return (
    <View style={{ gap: 6 }}>
      <Muted>
        {allowance.used} of {allowance.limit} sets published this month. Resets{' '}
        {new Date(allowance.resets_at).toLocaleDateString(undefined, { timeZone: 'UTC' })} (UTC).
      </Muted>
      <Muted>
        Creators earn {allowance.creator_reward_percent}% of the Stars spent on their packs. Free
        packs, set points and bonus packs do not earn Stars.
      </Muted>
      {allowance.used >= (allowance.limit ?? Infinity) && (
        <Muted>You can keep making drafts while you wait for next month's allowance.</Muted>
      )}
    </View>
  );
}

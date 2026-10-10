import Link from 'next/link';
import type { PublishingAllowance } from '@miscellary/shared';
import ui from './ui.module.css';

export default function PublishingNotice({ allowance }: { allowance: PublishingAllowance }) {
  if (!allowance.enabled) return null;
  return (
    <div>
      <p>
        <b>
          {allowance.used} of {allowance.limit} sets published this month.
        </b>{' '}
        Resets {new Date(allowance.resets_at).toLocaleDateString(undefined, { timeZone: 'UTC' })}{' '}
        (UTC).
      </p>
      <p className={ui.muted}>
        Creators earn {allowance.creator_reward_percent}% of the Stars spent on their packs. Free
        packs, set points and bonus packs do not earn Stars.
      </p>
      {allowance.used >= (allowance.limit ?? Infinity) && (
        <p className={ui.muted}>
          You can keep making drafts.{' '}
          <Link href="/account?section=membership">View membership</Link> or wait for next month's
          allowance.
        </p>
      )}
    </div>
  );
}

import Link from 'next/link';
import type { PublishingAllowance } from '@miscellary/shared';
import { publishingSummary } from '@miscellary/shared';
import ui from './ui.module.css';

export default function PublishingNotice({ allowance }: { allowance: PublishingAllowance }) {
  if (!allowance.enabled) return null;
  return (
    <div>
      <p>
        <b>{publishingSummary(allowance)}</b>
      </p>
      <p className={ui.muted}>
        Creators earn {allowance.creator_reward_percent}% of the tickets spent on their packs. Free
        packs, set points and bonus packs do not earn tickets.
      </p>
      {allowance.used >= (allowance.limit ?? Infinity) && (
        <p className={ui.muted}>
          You can keep making drafts. <Link href="/membership">View membership</Link> or wait for
          next month's allowance.
        </p>
      )}
    </div>
  );
}

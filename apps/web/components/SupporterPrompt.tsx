'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useMembership } from '@/lib/membership';
import ui from './ui.module.css';
import styles from './SupporterPrompt.module.css';

export const MEMBERSHIP_HREF = '/membership';

/** Explains a supporter feature where it would be used, while memberships are on. */
export default function SupporterPrompt({
  children,
  compact = false,
}: {
  children: ReactNode;
  compact?: boolean;
}) {
  const { enabled, supporter } = useMembership();
  if (!enabled || supporter) return null;
  return (
    <div className={`${styles.prompt} ${compact ? styles.compact : ''}`}>
      <p>{children}</p>
      <Link href={MEMBERSHIP_HREF} className={`${ui.btnPrimary} ${ui.btnSmall}`}>
        Become a supporter
      </Link>
    </div>
  );
}

export function SupporterTag() {
  return <span className={styles.tag}>Supporter</span>;
}

'use client';

import MembershipPanel from '@/components/MembershipPanel';
import PageHeader from '@/components/PageHeader';
import { useRequireAccount } from '@/lib/requireAccount';
import styles from '../account/page.module.css';

export default function MembershipPage() {
  useRequireAccount();
  return (
    <section className={styles.page}>
      <PageHeader
        title="Membership"
        description="Support Miscellary, get more packs and room, and buy tickets."
      />
      <MembershipPanel />
    </section>
  );
}

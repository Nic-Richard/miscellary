'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { loginHref } from '@/lib/returnTo';
import ui from '@/components/ui.module.css';
import styles from './page.module.css';

export function StartSetLink() {
  const { user, loading } = useAuth();
  if (loading) return null;
  return (
    <Link href={user ? '/studio' : loginHref('/studio')} className={ui.btnOutline}>
      Start a set
    </Link>
  );
}

export function HomeAuthBanner() {
  const { user, loading } = useAuth();
  if (loading || user) return null;
  return (
    <section className={`${ui.ticket} ${styles.make}`}>
      <div>
        <h2 className={styles.h2}>Start collecting and creating</h2>
        <p className={styles.makeText}>Log in to open packs and create sets.</p>
      </div>
      <div className={styles.makeActions}>
        <Link href="/login" className={ui.btnPrimary}>
          Log in
        </Link>
        <Link href="/register" className={ui.btnOutline}>
          Create an account
        </Link>
      </div>
    </section>
  );
}

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { AccountStatus } from '@miscellary/shared';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import Avatar from './Avatar';
import FeedbackDialog from './FeedbackDialog';
import { NOTICE_EVENT } from './Nav';
import SupporterEmblem from './SupporterEmblem';
import styles from './StatusBar.module.css';

export const STATUS_EVENT = 'miscellary:status';

const ICONS = {
  ticket:
    'M3 8a2 2 0 0 0 2-2h14a2 2 0 0 0 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 0-2 2H5a2 2 0 0 0-2-2v-2a2 2 0 0 0 0-4Z',
  pack: 'M7 3h10l1 3-1 15H7L6 6Zm-1 3h12m-8 5h4',
  trade: 'M4 8h13l-3-3M20 16H7l3 3',
  bell: 'M6 16v-5a6 6 0 0 1 12 0v5l2 2H4Zm4 4a2 2 0 0 0 4 0',
};

function Icon({ name }: { name: keyof typeof ICONS }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d={ICONS[name]} />
    </svg>
  );
}

export default function StatusBar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const [status, setStatus] = useState<AccountStatus | null>(null);
  const [menu, setMenu] = useState(false);
  const [feedback, setFeedback] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  const load = useCallback(() => {
    if (!user) {
      setStatus(null);
      return;
    }
    apiFetch<AccountStatus>('/api/v1/me/status/')
      .then(setStatus)
      .catch(() => undefined);
  }, [user]);

  // Refreshed on navigation and when something changes a count, rather than on a timer.
  useEffect(() => {
    load();
    setMenu(false);
  }, [load, pathname]);

  useEffect(() => {
    window.addEventListener(STATUS_EVENT, load);
    window.addEventListener(NOTICE_EVENT, load);
    return () => {
      window.removeEventListener(STATUS_EVENT, load);
      window.removeEventListener(NOTICE_EVENT, load);
    };
  }, [load]);

  useEffect(() => {
    if (!menu) return;
    function away(event: MouseEvent) {
      if (!root.current?.contains(event.target as Node)) setMenu(false);
    }
    function escape(event: KeyboardEvent) {
      if (event.key === 'Escape') setMenu(false);
    }
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('mousedown', away);
      document.removeEventListener('keydown', escape);
    };
  }, [menu]);

  if (!user || !status || pathname === '/') return null;
  const person = { ...user.profile, deleted: false, supporter_tier: status.supporter_tier };
  return (
    <div className={styles.dock}>
      <nav className={styles.bar} aria-label="Your status" ref={root}>
        <Link
          href="/membership"
          className={`${styles.chip} ${styles.tickets} ${status.tickets < 0 ? styles.owed : ''}`}
        >
          <Icon name="ticket" />
          <b>{status.tickets}</b>
          <small>{status.tickets < 0 ? 'owed' : status.tickets === 1 ? 'ticket' : 'tickets'}</small>
        </Link>
        {status.free_packs > 0 && (
          <Link href="/packs" className={styles.chip}>
            <Icon name="pack" />
            <b>{status.free_packs}</b>
            <small>{status.free_packs === 1 ? 'free pack' : 'free packs'}</small>
          </Link>
        )}
        {status.offers > 0 && (
          <Link href="/trades" className={styles.chip}>
            <Icon name="trade" />
            <b>{status.offers}</b>
            <small>{status.offers === 1 ? 'offer' : 'offers'}</small>
          </Link>
        )}
        <span className={styles.rule} aria-hidden="true" />
        <Link
          href="/notifications"
          className={`${styles.chip} ${styles.bell}`}
          aria-label={status.unread ? `Notifications, ${status.unread} unread` : 'Notifications'}
        >
          <Icon name="bell" />
          {status.unread > 0 && (
            <span className={styles.badge}>{status.unread > 99 ? '99+' : status.unread}</span>
          )}
        </Link>
        <button
          type="button"
          className={styles.me}
          aria-haspopup="menu"
          aria-expanded={menu}
          aria-label="Your account"
          onClick={() => setMenu((open) => !open)}
        >
          <Avatar person={person} badge={status.ring_style} size={28} />
          <SupporterEmblem tier={status.supporter_tier} />
        </button>
        {menu && (
          <div className={styles.menu} role="menu">
            <Link role="menuitem" href={`/users/${user.profile.username}`}>
              Your profile
            </Link>
            <Link role="menuitem" href="/membership">
              Membership
            </Link>
            <Link role="menuitem" href="/account">
              Account settings
            </Link>
            <button
              role="menuitem"
              type="button"
              onClick={() => {
                setMenu(false);
                setFeedback(true);
              }}
            >
              Send feedback
            </button>
            <button role="menuitem" type="button" onClick={() => void logout()}>
              Log out
            </button>
          </div>
        )}
      </nav>
      {feedback && <FeedbackDialog page={pathname} onClose={() => setFeedback(false)} />}
    </div>
  );
}

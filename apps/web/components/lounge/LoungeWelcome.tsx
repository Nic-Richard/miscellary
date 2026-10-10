'use client';

import { useAuth } from '@/lib/auth';
import ui from '@/components/ui.module.css';
import { useLounge } from './LoungeShell';
import styles from './Lounge.module.css';

export default function LoungeWelcome() {
  const { user } = useAuth();
  const { startDiscussion } = useLounge();
  return (
    <div className={styles.placeholder}>
      <p>Pick a discussion to read it here, or start your own.</p>
      <button
        type="button"
        className={user ? ui.btnOutline : ui.btnQuiet}
        onClick={startDiscussion}
      >
        {user ? 'Start a discussion' : 'Log in to start one'}
      </button>
    </div>
  );
}

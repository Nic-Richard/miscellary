'use client';

import { useState } from 'react';
import { resendVerificationEmail } from '@/lib/account';
import { useAuth } from '@/lib/auth';
import ui from './ui.module.css';
import styles from './VerifyEmailNotice.module.css';

export default function VerifyEmailNotice({ children }: { children: string }) {
  const { user } = useAuth();
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');

  if (!user || user.email_verified) return null;

  async function resend() {
    setState('sending');
    try {
      await resendVerificationEmail();
      setState('sent');
    } catch {
      setState('failed');
    }
  }

  return (
    <div className={styles.notice} role="status">
      <p>
        {children}{' '}
        {state === 'sent'
          ? `A fresh link is on its way to ${user.email}.`
          : `Check ${user.email} for the link.`}
      </p>
      {state === 'sent' ? null : (
        <button
          type="button"
          className={`${ui.btnQuiet} ${ui.btnSmall}`}
          disabled={state === 'sending'}
          onClick={() => void resend()}
        >
          {state === 'failed' ? 'Try sending again' : 'Send the link again'}
        </button>
      )}
    </div>
  );
}

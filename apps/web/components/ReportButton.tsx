'use client';

import { useState } from 'react';
import type { ReportReason } from '@miscellary/shared';
import { useAuth } from '@/lib/auth';
import { REPORT_REASONS, sendReport } from '@/lib/social';
import ui from './ui.module.css';
import styles from './ReportButton.module.css';

type Target =
  { set_slug: string } | { card_id: string } | { comment_id: string } | { username: string };

export default function ReportButton({ target }: { target: Target }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason>('other');
  const [details, setDetails] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!user) return null;
  if (done) return <span className={styles.done}>Reported. Thanks.</span>;

  async function submit() {
    try {
      await sendReport({ ...target, reason, details });
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send the report.');
    }
  }

  return open ? (
    <div className={styles.form}>
      <select
        className={styles.input}
        value={reason}
        onChange={(e) => setReason(e.target.value as ReportReason)}
      >
        {REPORT_REASONS.map((r) => (
          <option key={r.value} value={r.value}>
            {r.label}
          </option>
        ))}
      </select>
      <input
        className={styles.input}
        placeholder="Details (optional)"
        value={details}
        onChange={(e) => setDetails(e.target.value)}
        maxLength={1000}
      />
      <button type="button" className={styles.send} onClick={() => void submit()}>
        Send report
      </button>
      <button type="button" className={styles.link} onClick={() => setOpen(false)}>
        Cancel
      </button>
      {error ? <span className={styles.error}>{error}</span> : null}
    </div>
  ) : (
    <button
      type="button"
      aria-label="Report this"
      className={`${ui.action} ${ui.actionQuiet}`}
      onClick={() => setOpen(true)}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 8v5m0 3h.01M10.3 4.3 2.9 17.5a2 2 0 0 0 1.7 3h14.8a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0Z" />
      </svg>
      Report
    </button>
  );
}

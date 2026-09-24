'use client';

import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import type { ReportReason } from '@miscellary/shared';
import { REPORT_REASONS, sendReport } from '@/lib/social';
import ui from './ui.module.css';
import styles from './ReportDialog.module.css';

export type ReportTarget =
  { set_slug: string } | { card_id: string } | { comment_id: string } | { username: string };

export default function ReportDialog({
  target,
  subject,
  onClose,
}: {
  target: ReportTarget;
  subject: string;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [state, setState] = useState<'editing' | 'sending' | 'sent'>('editing');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!reason) return;
    setState('sending');
    setError(null);
    try {
      await sendReport({ ...target, reason, details });
      setState('sent');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send the report.');
      setState('editing');
    }
  }

  const close = () => dialog.current?.close();

  return (
    <dialog
      ref={dialog}
      className={styles.dialog}
      aria-labelledby="report-title"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      {state === 'sent' ? (
        <div className={styles.body}>
          <h2 id="report-title" className={styles.title}>
            Report sent
          </h2>
          <p className={styles.note}>
            Thanks. A moderator will look at it, and will only be in touch if they need more detail.
          </p>
          <div className={styles.buttons}>
            <button type="button" className={ui.btnPrimary} onClick={close}>
              Done
            </button>
          </div>
        </div>
      ) : (
        <form className={styles.body} onSubmit={(e) => void submit(e)}>
          <h2 id="report-title" className={styles.title}>
            Report {subject}
          </h2>
          <fieldset className={styles.reasons}>
            <legend className={styles.note}>What is wrong with it?</legend>
            {REPORT_REASONS.map((r) => (
              <label key={r.value} className={styles.reason}>
                <input
                  type="radio"
                  name="reason"
                  value={r.value}
                  checked={reason === r.value}
                  onChange={() => setReason(r.value)}
                />
                {r.label}
              </label>
            ))}
          </fieldset>
          <label className={ui.label} htmlFor="report-details">
            Anything else to add (optional)
          </label>
          <textarea
            id="report-details"
            className={ui.input}
            rows={3}
            maxLength={1000}
            value={details}
            onChange={(e) => setDetails(e.target.value)}
          />
          {error ? <p className={ui.error}>{error}</p> : null}
          <div className={styles.buttons}>
            <button type="button" className={ui.btnQuiet} onClick={close}>
              Cancel
            </button>
            <button
              type="submit"
              className={ui.btnPrimary}
              disabled={!reason || state === 'sending'}
            >
              {state === 'sending' ? 'Sending…' : 'Send report'}
            </button>
          </div>
        </form>
      )}
    </dialog>
  );
}

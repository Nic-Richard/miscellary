'use client';

import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import type { FeedbackKind } from '@miscellary/shared';
import { FEEDBACK_KINDS, sendFeedback } from '@/lib/social';
import ui from './ui.module.css';
import styles from './ReportDialog.module.css';

export default function FeedbackDialog({ page, onClose }: { page: string; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [kind, setKind] = useState<FeedbackKind>('bug');
  const [message, setMessage] = useState('');
  const [state, setState] = useState<'editing' | 'sending' | 'sent'>('editing');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setState('sending');
    setError(null);
    try {
      await sendFeedback({ kind, message, page, client: 'web' });
      setState('sent');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send your feedback.');
      setState('editing');
    }
  }

  const close = () => dialog.current?.close();

  return (
    <dialog
      ref={dialog}
      className={styles.dialog}
      aria-labelledby="feedback-title"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      {state === 'sent' ? (
        <div className={styles.body}>
          <h2 id="feedback-title" className={styles.title}>
            Feedback sent
          </h2>
          <p className={styles.note}>
            Thanks. Every message is read, and you&rsquo;ll get an email if there&rsquo;s a
            question.
          </p>
          <div className={styles.buttons}>
            <button type="button" className={ui.btnPrimary} onClick={close}>
              Done
            </button>
          </div>
        </div>
      ) : (
        <form className={styles.body} onSubmit={(e) => void submit(e)}>
          <h2 id="feedback-title" className={styles.title}>
            Send feedback
          </h2>
          <fieldset className={styles.reasons}>
            <legend className={styles.note}>What is it about?</legend>
            {FEEDBACK_KINDS.map((k) => (
              <label key={k.value} className={styles.reason}>
                <input
                  type="radio"
                  name="kind"
                  value={k.value}
                  checked={kind === k.value}
                  onChange={() => setKind(k.value)}
                />
                {k.label}
              </label>
            ))}
          </fieldset>
          <label className={ui.label} htmlFor="feedback-message">
            {kind === 'bug' ? 'What happened, and what did you expect?' : 'Tell us more'}
          </label>
          <textarea
            id="feedback-message"
            className={ui.input}
            rows={5}
            minLength={10}
            maxLength={2000}
            required
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
          <p className={styles.note}>
            Your message and account details are saved by Miscellary and sent to its private staff
            channel on Discord. Avoid including passwords or other sensitive information.
          </p>
          {error ? <p className={ui.error}>{error}</p> : null}
          <div className={styles.buttons}>
            <button type="button" className={ui.btnQuiet} onClick={close}>
              Cancel
            </button>
            <button
              type="submit"
              className={ui.btnPrimary}
              disabled={message.trim().length < 10 || state === 'sending'}
            >
              {state === 'sending' ? 'Sending…' : 'Send feedback'}
            </button>
          </div>
        </form>
      )}
    </dialog>
  );
}

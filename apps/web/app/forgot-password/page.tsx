'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { FormEvent } from 'react';
import Field from '@/components/Field';
import styles from '@/components/AuthForm.module.css';
import { ApiRequestError } from '@/lib/api';
import { requestPasswordReset } from '@/lib/account';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await requestPasswordReset(email);
      setSent(true);
    } catch (caught) {
      setError(caught instanceof ApiRequestError ? caught.message : 'Could not send that email.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className={styles.wrap} onSubmit={(event) => void submit(event)}>
      <h1 className={styles.title}>Reset password</h1>
      {error ? <div className={styles.error}>{error}</div> : null}
      {sent ? (
        <>
          <p className={styles.alt}>If that address has an account, a reset link is on its way.</p>
          <p className={styles.alt}>
            <Link href="/login">Back to login</Link>
          </p>
        </>
      ) : (
        <>
          <Field
            id="email"
            label="Email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
          <button className={styles.submit} type="submit" disabled={busy}>
            {busy ? 'Sending…' : 'Send reset link'}
          </button>
          <p className={styles.alt}>
            <Link href="/login">Back to login</Link>
          </p>
        </>
      )}
    </form>
  );
}

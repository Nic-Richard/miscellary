'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import type { FormEvent } from 'react';
import Field from '@/components/Field';
import styles from '@/components/AuthForm.module.css';
import { ApiRequestError } from '@/lib/api';
import { confirmPasswordReset } from '@/lib/account';

function ResetPassword() {
  const search = useSearchParams();
  const uid = search.get('uid');
  const token = search.get('token');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<string[]>([]);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const complete = Boolean(uid && token);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!uid || !token) return;
    setBusy(true);
    setError(null);
    setFieldErrors([]);
    try {
      await confirmPasswordReset(uid, token, password);
      setDone(true);
    } catch (caught) {
      if (caught instanceof ApiRequestError) {
        setError(caught.fields.token?.[0] ?? caught.message);
        setFieldErrors(caught.fields.password ?? []);
      } else {
        setError('Could not reset the password.');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className={styles.wrap} onSubmit={(event) => void submit(event)}>
      <h1 className={styles.title}>Choose a password</h1>
      {!complete ? <div className={styles.error}>This reset link is incomplete.</div> : null}
      {error ? <div className={styles.error}>{error}</div> : null}
      {done ? (
        <>
          <p className={styles.alt}>Your password has been changed.</p>
          <p className={styles.alt}>
            <a href="miscellary://login">Return to the app</a> or{' '}
            <Link href="/login">log in here</Link>
          </p>
        </>
      ) : (
        <>
          <Field
            id="password"
            label="New password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            errors={fieldErrors}
            required
          />
          <button className={styles.submit} type="submit" disabled={busy || !complete}>
            {busy ? 'Saving…' : 'Save password'}
          </button>
        </>
      )}
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPassword />
    </Suspense>
  );
}

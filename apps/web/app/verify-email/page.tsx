'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';
import styles from '@/components/AuthForm.module.css';
import { ApiRequestError } from '@/lib/api';
import { confirmEmailVerification } from '@/lib/account';

type Status = 'checking' | 'verified' | 'error';

function VerifyEmail() {
  const search = useSearchParams();
  const started = useRef(false);
  const [status, setStatus] = useState<Status>('checking');
  const [message, setMessage] = useState('Checking your verification link…');

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const token = search.get('token');
    if (!token) {
      setStatus('error');
      setMessage('This verification link is incomplete.');
      return;
    }
    confirmEmailVerification(token)
      .then(() => {
        setStatus('verified');
        setMessage('Your email address is verified.');
      })
      .catch((error: unknown) => {
        setStatus('error');
        setMessage(
          error instanceof ApiRequestError
            ? (error.fields.token?.[0] ?? error.message)
            : 'Could not verify this email address.',
        );
      });
  }, [search]);

  return (
    <section className={styles.wrap}>
      <h1 className={styles.title}>Verify email</h1>
      <p className={status === 'error' ? styles.error : styles.alt}>{message}</p>
      {status === 'verified' ? (
        <p className={styles.alt}>
          <a href="miscellary://settings">Return to the app</a> or{' '}
          <Link href="/">browse the site</Link>
        </p>
      ) : null}
      {status === 'error' ? (
        <p className={styles.alt}>
          Sign in and request a fresh link from your <Link href="/account">account</Link>.
        </p>
      ) : null}
    </section>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmail />
    </Suspense>
  );
}

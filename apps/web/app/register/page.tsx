'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import type { FormEvent } from 'react';
import Field from '@/components/Field';
import { ApiRequestError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { returnPath, swapAuthHref } from '@/lib/returnTo';
import styles from '@/components/AuthForm.module.css';

function RegisterForm() {
  const { register } = useAuth();
  const router = useRouter();
  const search = useSearchParams();
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string[]>>({});
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setFields({});
    try {
      await register({ email, username, password });
      router.replace(returnPath(search));
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError(err.message);
        setFields(err.fields);
      } else {
        setError('Sign up failed.');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className={styles.wrap} onSubmit={onSubmit}>
      <h1 className={styles.title}>Create your account</h1>
      {error && <div className={styles.error}>{error}</div>}
      <Field
        id="email"
        label="Email"
        type="email"
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        errors={fields.email}
        required
      />
      <Field
        id="username"
        label="Username"
        autoComplete="username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        errors={fields.username}
        required
      />
      <Field
        id="password"
        label="Password"
        type="password"
        autoComplete="new-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        errors={fields.password}
        required
      />
      <button className={styles.submit} type="submit" disabled={busy}>
        {busy ? 'Creating…' : 'Sign up'}
      </button>
      <p className={styles.alt}>
        Already have an account? <Link href={swapAuthHref('/login', search)}>Log in</Link>
      </p>
    </form>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterForm />
    </Suspense>
  );
}

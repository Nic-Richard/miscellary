'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { GoogleProof } from '@miscellary/shared';
import { ApiRequestError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import Field from './Field';
import GoogleButton from './GoogleButton';
import form from './AuthForm.module.css';
import styles from './GoogleAuth.module.css';

export default function GoogleAuth({ onDone }: { onDone: () => void }) {
  const { googleLogin, googleRegister } = useAuth();
  const [proof, setProof] = useState<GoogleProof | null>(null);
  const [username, setUsername] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function login(value: GoogleProof) {
    try {
      await googleLogin(value);
      onDone();
    } catch (err) {
      if (err instanceof ApiRequestError && err.code === 'google_signup_required') setProof(value);
      else throw err;
    }
  }

  async function signup() {
    if (!proof || busy) return;
    setBusy(true);
    setError(null);
    try {
      await googleRegister({ ...proof, username, terms_accepted: accepted });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign up failed.');
    } finally {
      setBusy(false);
    }
  }

  if (!process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID) return null;
  return proof ? (
    <form
      className={styles.signup}
      onSubmit={(e) => {
        e.preventDefault();
        void signup();
      }}
    >
      <p>Choose a username to finish creating your account.</p>
      <Field
        id="google-username"
        label="Username"
        autoComplete="username"
        value={username}
        maxLength={20}
        onChange={(e) => setUsername(e.target.value)}
      />
      <label>
        <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} />{' '}
        I agree to the <Link href="/terms">terms</Link> and{' '}
        <Link href="/privacy">privacy policy</Link>.
      </label>
      {error && (
        <p className={form.error} role="alert">
          {error}
        </p>
      )}
      <button
        type="submit"
        className={form.submit}
        disabled={busy || !accepted || !username.trim()}
      >
        {busy ? 'Creating…' : 'Create account'}
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          setProof(null);
          setError(null);
        }}
      >
        Choose another sign-in method
      </button>
    </form>
  ) : (
    <GoogleButton onCredential={login} />
  );
}

'use client';

import { useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import type { CurrentUser } from '@miscellary/shared';
import { ApiRequestError } from '@/lib/api';
import { changePassword, changeUsername, resendVerificationEmail } from '@/lib/account';
import ui from './ui.module.css';
import styles from './AccountSecurity.module.css';

function fieldError(error: unknown, name: string): string {
  if (error instanceof ApiRequestError) return error.fields[name]?.[0] ?? error.message;
  return error instanceof Error ? error.message : 'Something went wrong.';
}

function Row({ title, note, children }: { title: string; note: string; children: ReactNode }) {
  return (
    <div className={ui.rowItem}>
      <div className={ui.rowHead}>
        <h3>{title}</h3>
        <p>{note}</p>
      </div>
      <div className={styles.body}>{children}</div>
    </div>
  );
}

function Username({ user, onChanged }: { user: CurrentUser; onChanged: () => Promise<void> }) {
  const [username, setUsername] = useState(user.profile.username);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const locked = user.username_change_available_at;
  const readyOn = locked ? new Date(locked).toLocaleDateString() : null;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setDone(false);
    try {
      await changeUsername(username.trim().toLowerCase(), password);
      await onChanged();
      setPassword('');
      setDone(true);
    } catch (err) {
      setError(fieldError(err, 'username'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Row
      title="Username"
      note={
        readyOn
          ? `Changeable again on ${readyOn}. Until then your previous name stays reserved, so nobody else can stand where an old link points.`
          : 'Your profile lives at this address. Changing it keeps your old name reserved for you, and you can change again after 30 days.'
      }
    >
      <form className={styles.form} onSubmit={(e) => void submit(e)}>
        <div className={styles.pair}>
          <label className={styles.field}>
            <span className={ui.label}>Username</span>
            <span className={styles.at}>
              <span aria-hidden="true">@</span>
              <input
                className={ui.input}
                value={username}
                disabled={Boolean(locked) || busy}
                maxLength={20}
                autoComplete="username"
                onChange={(e) => setUsername(e.target.value)}
              />
            </span>
          </label>
          {locked ? null : (
            <label className={styles.field}>
              <span className={ui.label}>Current password</span>
              <input
                className={ui.input}
                type="password"
                value={password}
                autoComplete="current-password"
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
          )}
        </div>
        {error ? <p className={ui.error}>{error}</p> : null}
        {done ? <p className={styles.done}>Username changed.</p> : null}
        <div>
          <button
            type="submit"
            className={ui.action}
            disabled={
              Boolean(locked) ||
              busy ||
              !password ||
              username.trim().toLowerCase() === user.profile.username
            }
          >
            Change username
          </button>
        </div>
      </form>
    </Row>
  );
}

function Email({ user }: { user: CurrentUser }) {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function resend() {
    setBusy(true);
    setError(null);
    try {
      await resendVerificationEmail();
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send that.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Row
      title="Email"
      note="Used to sign in and to reset your password. It is never shown on your profile."
    >
      <div className={styles.form}>
        <p className={styles.value}>
          {user.email}
          {user.email_verified ? (
            <span className={styles.verified}>Verified</span>
          ) : (
            <span className={styles.unverified}>Unverified</span>
          )}
        </p>
        {user.email_verified ? null : (
          <>
            {error ? <p className={ui.error}>{error}</p> : null}
            {sent ? <p className={styles.done}>Verification email sent.</p> : null}
            <div>
              <button
                type="button"
                className={ui.action}
                disabled={busy || sent}
                onClick={() => void resend()}
              >
                Send the link again
              </button>
            </div>
          </>
        )}
      </div>
    </Row>
  );
}

function Password() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setDone(false);
    try {
      await changePassword(current, next);
      setCurrent('');
      setNext('');
      setDone(true);
    } catch (err) {
      setError(fieldError(err, 'new_password'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Row title="Password" note="At least eight characters, and not one you use elsewhere.">
      <form className={styles.form} onSubmit={(e) => void submit(e)}>
        <div className={styles.pair}>
          <label className={styles.field}>
            <span className={ui.label}>Current password</span>
            <input
              className={ui.input}
              type="password"
              value={current}
              autoComplete="current-password"
              onChange={(e) => setCurrent(e.target.value)}
            />
          </label>
          <label className={styles.field}>
            <span className={ui.label}>New password</span>
            <input
              className={ui.input}
              type="password"
              value={next}
              autoComplete="new-password"
              onChange={(e) => setNext(e.target.value)}
            />
          </label>
        </div>
        {error ? <p className={ui.error}>{error}</p> : null}
        {done ? <p className={styles.done}>Password changed.</p> : null}
        <div>
          <button type="submit" className={ui.action} disabled={busy || !current || !next}>
            Change password
          </button>
        </div>
      </form>
    </Row>
  );
}

export default function AccountSecurity({
  user,
  onChanged,
}: {
  user: CurrentUser;
  onChanged: () => Promise<void>;
}) {
  return (
    <div className={`${ui.panel} ${styles.sheet}`}>
      <div className={ui.rows}>
        <Username user={user} onChanged={onChanged} />
        <Email user={user} />
        <Password />
      </div>
    </div>
  );
}

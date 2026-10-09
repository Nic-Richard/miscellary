'use client';

import type { GoogleProof, GooglePurpose } from '@miscellary/shared';
import { useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/lib/api';
import styles from './GoogleAuth.module.css';

interface GoogleId {
  initialize: (options: {
    client_id: string;
    nonce: string;
    callback: (response: { credential: string }) => void;
    auto_select: boolean;
  }) => void;
  renderButton: (
    element: HTMLElement,
    options: {
      type: 'standard';
      theme: 'outline';
      size: 'large';
      text: 'continue_with';
    },
  ) => void;
}

declare global {
  interface Window {
    google?: { accounts: { id: GoogleId } };
  }
}

let script: Promise<GoogleId> | null = null;

function loadGoogle(): Promise<GoogleId> {
  if (window.google) return Promise.resolve(window.google.accounts.id);
  script ??= new Promise<GoogleId>((resolve, reject) => {
    const element = document.createElement('script');
    const timeout = window.setTimeout(() => {
      element.remove();
      reject(new Error('Google sign-in took too long to load. Please try again.'));
    }, 15_000);
    element.src = 'https://accounts.google.com/gsi/client';
    element.async = true;
    element.onload = () => {
      window.clearTimeout(timeout);
      if (window.google) resolve(window.google.accounts.id);
      else {
        element.remove();
        reject(new Error('Google sign-in could not load.'));
      }
    };
    element.onerror = () => {
      window.clearTimeout(timeout);
      element.remove();
      reject(
        new Error('Google sign-in could not load. Check your connection or browser blockers.'),
      );
    };
    document.head.appendChild(element);
  }).catch((error: unknown) => {
    script = null;
    throw error;
  });
  return script;
}

export default function GoogleButton({
  purpose = 'login',
  onCredential,
}: {
  purpose?: GooglePurpose;
  onCredential: (proof: GoogleProof) => Promise<void>;
}) {
  const target = useRef<HTMLDivElement>(null);
  const handler = useRef(onCredential);
  handler.current = onCredential;
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  useEffect(() => {
    if (!clientId) return;
    let cancelled = false;
    let submitting = false;
    const element = target.current;
    setReady(false);
    setError(null);
    const timer = window.setTimeout(() => setAttempt((value) => value + 1), 240_000);
    void (async () => {
      try {
        const google = await loadGoogle();
        if (cancelled) return;
        const { nonce } = await apiFetch<{ nonce: string }>('/api/v1/auth/google/challenge/', {
          method: 'POST',
          body: { purpose },
          auth: purpose !== 'login',
        });
        if (cancelled || !element) return;
        google.initialize({
          client_id: clientId,
          nonce,
          auto_select: false,
          callback: ({ credential }) => {
            if (cancelled || submitting) return;
            submitting = true;
            window.clearTimeout(timer);
            setBusy(true);
            void handler
              .current({ credential, nonce })
              .catch((err: unknown) => {
                if (!cancelled)
                  setError(err instanceof Error ? err.message : 'Google sign-in failed.');
              })
              .finally(() => {
                if (!cancelled) {
                  setBusy(false);
                  setReady(false);
                  element.replaceChildren();
                }
              });
          },
        });
        google.renderButton(element, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text: 'continue_with',
        });
        setReady(true);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Google sign-in failed.');
      }
    })();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      element?.replaceChildren();
    };
  }, [clientId, purpose, attempt]);

  if (!clientId) return null;
  return (
    <div className={styles.google}>
      <div ref={target} hidden={busy} />
      {(busy || !ready) && !error && (
        <p role="status">{busy ? 'Confirming with Google…' : 'Loading Google sign-in…'}</p>
      )}
      {error && <p role="alert">{error}</p>}
      {error && (
        <button type="button" onClick={() => setAttempt((value) => value + 1)}>
          Try Google again
        </button>
      )}
    </div>
  );
}

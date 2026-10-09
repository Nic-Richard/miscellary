'use client';

import type { GoogleConfirmation, GooglePurpose } from '@miscellary/shared';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import GoogleButton from './GoogleButton';
import styles from './GoogleAuth.module.css';

export default function useGoogleConfirmation() {
  const [purpose, setPurpose] = useState<GooglePurpose | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const pending = useRef<{
    resolve: (proof: GoogleConfirmation) => void;
    reject: (error: Error) => void;
  } | null>(null);
  function cancel() {
    pending.current?.reject(new Error('Google confirmation cancelled.'));
    pending.current = null;
    setPurpose(null);
  }
  useEffect(() => {
    if (purpose) dialog.current?.showModal();
  }, [purpose]);
  useEffect(
    () => () => {
      pending.current?.reject(new Error('Google confirmation cancelled.'));
    },
    [],
  );

  function confirm(value: GooglePurpose): Promise<GoogleConfirmation> {
    if (!process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID)
      return Promise.reject(new Error('Google sign-in is not configured.'));
    if (pending.current)
      return Promise.reject(new Error('Finish the current Google confirmation first.'));
    setPurpose(value);
    return new Promise((resolve, reject) => {
      pending.current = { resolve, reject };
    });
  }

  const confirmation =
    purpose &&
    createPortal(
      <dialog
        ref={dialog}
        className={styles.dialog}
        aria-labelledby="google-confirm-title"
        onCancel={cancel}
      >
        <h2 id="google-confirm-title">Confirm with Google</h2>
        <p>Use the Google account connected to Miscellary.</p>
        <GoogleButton
          purpose={purpose}
          onCredential={async ({ credential, nonce }) => {
            pending.current?.resolve({ google_credential: credential, google_nonce: nonce });
            pending.current = null;
            setPurpose(null);
          }}
        />
        <button type="button" onClick={cancel}>
          Cancel
        </button>
      </dialog>,
      document.body,
    );
  return { confirm, confirmation };
}

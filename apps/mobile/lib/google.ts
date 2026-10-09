import type { GoogleConfirmation, GoogleProof, GooglePurpose } from '@miscellary/shared';
import { Platform } from 'react-native';
import { apiFetch } from './api';

export const googleAvailable =
  Platform.OS === 'android' && Boolean(process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID);
let pending = false;

export async function googleProof(purpose: GooglePurpose = 'login'): Promise<GoogleProof> {
  if (!googleAvailable) throw new Error('Google sign-in is not configured on this device.');
  if (pending) throw new Error('Finish the current Google confirmation first.');
  pending = true;
  try {
    const { GoogleOneTapSignIn, isSuccessResponse } =
      await import('react-native-nitro-google-signin');
    const { nonce } = await apiFetch<{ nonce: string }>('/api/v1/auth/google/challenge/', {
      method: 'POST',
      body: { purpose },
      auth: purpose !== 'login',
    });
    // The SDK passes an explicit nonce unchanged to Credential Manager.
    GoogleOneTapSignIn.configure({
      webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID!,
      nonce,
    });
    const response = await GoogleOneTapSignIn.presentExplicitSignIn();
    if (!isSuccessResponse(response)) throw new Error('Google sign-in cancelled.');
    return { credential: response.data.idToken, nonce };
  } finally {
    pending = false;
  }
}

export async function confirmGoogle(purpose: GooglePurpose): Promise<GoogleConfirmation> {
  const proof = await googleProof(purpose);
  return { google_credential: proof.credential, google_nonce: proof.nonce };
}

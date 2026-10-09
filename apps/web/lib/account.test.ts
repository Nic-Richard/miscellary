import { afterEach, expect, it, vi } from 'vitest';
import { changePassword, changeUsername, deleteAccount } from './account';
import { apiFetch, setAccessToken } from './api';

afterEach(() => {
  vi.restoreAllMocks();
  setAccessToken(null);
});

it('keeps password confirmations unchanged', async () => {
  const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}'));
  await changeUsername('collector', 'current-password');
  expect(JSON.parse(fetch.mock.calls[0]![1]!.body as string)).toEqual({
    username: 'collector',
    current_password: 'current-password',
  });
});

it('sends Google confirmation in the body, never the URL', async () => {
  const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response('{}'));
  const proof = { google_credential: 'signed-credential', google_nonce: 'single-use-nonce' };
  await changeUsername('collector', '', proof);
  await deleteAccount('', proof);
  for (const [url, init] of fetch.mock.calls) {
    expect(String(url)).not.toContain(proof.google_credential);
    expect(JSON.parse(init!.body as string)).toMatchObject({ current_password: '', ...proof });
  }
});

it('keeps the replacement session after setting a Google-only account password', async () => {
  const fetch = vi
    .spyOn(globalThis, 'fetch')
    .mockResolvedValueOnce(new Response(JSON.stringify({ access: 'new-session' })))
    .mockResolvedValueOnce(new Response('{}'));
  await changePassword('', 'new-password', {
    google_credential: 'credential',
    google_nonce: 'nonce',
  });
  await apiFetch('/api/v1/auth/me/');
  expect((fetch.mock.calls[1]![1]!.headers as Record<string, string>).Authorization).toBe(
    'Bearer new-session',
  );
});

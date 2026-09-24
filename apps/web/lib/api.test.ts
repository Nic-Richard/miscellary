import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiRequestError, apiFetch, setAccessToken } from './api';

afterEach(() => {
  vi.restoreAllMocks();
  setAccessToken(null);
});

describe('apiFetch', () => {
  it('returns parsed JSON and sends the bearer token', async () => {
    setAccessToken('abc');
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    await expect(apiFetch('/x')).resolves.toEqual({ ok: true });
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer abc');
  });

  it('normalises API errors', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: 'Nope', fields: { email: ['taken'] } }), {
        status: 400,
      }),
    );
    await expect(apiFetch('/x')).rejects.toMatchObject({
      status: 400,
      message: 'Nope',
      fields: { email: ['taken'] },
    });
  });

  it('normalises network failures', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('down'));
    const err = await apiFetch('/x').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiRequestError);
    expect((err as ApiRequestError).status).toBe(0);
  });

  it('refreshes once after a 401 and retries with the new access token', async () => {
    setAccessToken('expired');
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ access: 'fresh' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));

    await expect(apiFetch('/x')).resolves.toEqual({ ok: true });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[1]?.[0]).toContain('/api/v1/auth/refresh/');
    const retried = fetchMock.mock.calls[2]?.[1] as RequestInit;
    expect((retried.headers as Record<string, string>).Authorization).toBe('Bearer fresh');
  });

  it('shares one refresh between concurrent 401s', async () => {
    setAccessToken('expired');
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      if (String(input).includes('/auth/refresh/')) {
        return new Response(JSON.stringify({ access: 'fresh' }), { status: 200 });
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response(null, { status: 401 }));

    await Promise.all([apiFetch('/a'), apiFetch('/b')]);

    const refreshes = fetchMock.mock.calls.filter(([input]) =>
      String(input).includes('/auth/refresh/'),
    );
    expect(refreshes).toHaveLength(1);
  });

  it('keeps the error code the client can act on', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: 'Verify first.', code: 'email_unverified' }), {
        status: 403,
      }),
    );
    await expect(apiFetch('/x')).rejects.toMatchObject({ code: 'email_unverified' });
  });
});

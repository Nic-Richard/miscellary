# ADR 001: Authentication

**Status:** accepted

## Decision

Django owns accounts. Auth is JWT via `djangorestframework-simplejwt`:

- Access tokens: 15 minutes, sent as `Authorization: Bearer`.
- Refresh tokens: 30 days, rotated on every use, old token blacklisted
  (`rest_framework_simplejwt.token_blacklist`).
- Transport is chosen by the `X-Client-Platform` header:
  - `web` (default): refresh token in an HttpOnly, SameSite=Lax cookie scoped to
    `/api/v1/auth`. The browser never sees it; the SPA keeps only the access token in memory.
  - `mobile`: refresh token in the response body; Expo stores it in SecureStore.
- Email verification and password reset use signed, expiring tokens
  (`django.core.signing` and `PasswordResetTokenGenerator`), so no extra tables.
- Every error response is `{ "error": string, "fields"?: { [name]: string[] } }`.

## Why not Clerk

The project plan calls for hands-on ownership of the account lifecycle. SimpleJWT is small,
well maintained, and its blacklist app gives rotation without custom tables.

## Consequences

- CORS must allow credentials from the web origin (`CORS_ALLOWED_ORIGINS`).
- Production must set `COOKIE_SECURE=true`. With web and API on subdomains of one domain
  (`app.example.com`, `api.example.com`) the cookie stays `SameSite=Lax`; on unrelated domains
  set `COOKIE_SAMESITE=None`, which browsers only honour together with `Secure`.
- Access-token expiry is short, so clients refresh on 401 and retry the request.

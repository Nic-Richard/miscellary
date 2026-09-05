# Release checklist

## Before the first public release

- [ ] Android on a real device: camera permission prompt and denial, system crop returns a 4:5 image, upload completes on mobile data, SecureStore session survives a force-stop, Android back from every stack screen, deep links `miscellary://sets/<slug>` open the binder.
- [ ] Web on a phone browser: register, upload, open a pack, trade.
- [ ] Production email delivery from SES (verification and reset links point at `WEB_URL`).
- [ ] Refresh cookie works cross-origin from the Vercel domain (`COOKIE_SAMESITE` correct).
- [ ] S3 CORS allows the production web origin only.
- [ ] `ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS`, `CSRF_TRUSTED_ORIGINS` contain the real hostnames.
- [ ] Admin reachable at `/admin/` over HTTPS and static files load (whitenoise).
- [ ] Terms and privacy pages exist and the report reasons match them.

## Every release

- [ ] CI green on `main`.
- [ ] `docs/API.md` updated if endpoints changed.
- [ ] New migrations reviewed for locks on large tables (they run on container start).
- [ ] `scripts/deploy-api.sh`, then watch `/api/v1/health/` and one login on the live site.
- [ ] Mobile: bump `version` in `app.json` when the API contract changed.

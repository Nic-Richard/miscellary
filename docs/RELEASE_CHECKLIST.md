# Release checklist

## Before the first public release

- [ ] Android on a real device: camera permission prompt and denial, system crop returns a 4:5 image, upload completes on mobile data, SecureStore session survives a force-stop, Android back from every stack screen, deep links `miscellary://sets/<slug>` open the binder.
- [ ] Web on a phone browser: register, upload, open a pack, trade.
- [ ] Compare a production-like web build and installed Android build before treating Docker/Expo Go lag as renderer performance.
- [ ] Production bootstrap accounts are visibly marked as demo accounts, including an accessible label.
- [ ] Bootstrap card imagery has durable source/license records and no source or seed metadata is printed in normal card copy.
- [ ] `bootstrap_catalogue` reports every manifest set as verified on a second production run.
- [ ] Every bootstrapped card, set back, and pack passes `verify_renders` after render import.
- [ ] Production email delivery from SES: verification and password-reset links point at `WEB_URL`, complete in the browser, and return to the installed Android app.
- [ ] `support@miscellary.com` and `privacy@miscellary.com` receive mail before publishing legal pages.
- [ ] Refresh cookie works cross-origin from `miscellary.com` (`COOKIE_SAMESITE=Lax`).
- [ ] S3 CORS allows the production web origin only.
- [ ] A source object rejects an unsigned GET, its API URL works while signed, a CloudFront
      `renders/*` URL works, and the equivalent raw S3 render URL is denied.
- [ ] `ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS`, `CSRF_TRUSTED_ORIGINS` contain the real hostnames.
- [ ] RDS is private, Single-AZ, backed up, and reachable only from the API security group.
- [ ] ECS runs one healthy task and the API task accepts port 8000 only from the load balancer.
- [ ] CloudWatch logs arrive and the SNS alarm subscription is confirmed.
- [ ] GitHub's production environment can deploy through OIDC without a stored AWS access key.
- [ ] Admin reachable at `/admin/` over HTTPS and static files load (whitenoise).
- [ ] Terms and privacy pages exist and the report reasons match them.

## Every release

- [ ] CI green on `main`.
- [ ] `docs/API.md` updated if endpoints changed.
- [ ] New migrations reviewed for locks on large tables (the deploy runs them as a one-off ECS task).
- [ ] `bash scripts/deploy-api.sh`, then watch `/api/v1/health/` and one login on the live site.
- [ ] Mobile: bump `version` in `app.json` when the API contract changed.

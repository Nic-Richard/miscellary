# Deployment

Production uses one container service, one database, one bucket, and one static host. Nothing in
this directory holds secrets; account-specific values belong in `.env.deploy` or AWS Secrets
Manager.

| Piece      | Where                                                           | Why                                                            |
| ---------- | --------------------------------------------------------------- | -------------------------------------------------------------- |
| Django API | AWS App Runner (container from ECR)                             | HTTPS, scaling, and rolling deploys without managing a cluster |
| PostgreSQL | AWS RDS (`db.t4g.micro`, single AZ)                             | managed backups and upgrades                                   |
| Images     | AWS S3 (public-read objects, browser uploads via presigned PUT) | the API never proxies image bytes                              |
| Web        | Vercel (Next.js)                                                | zero-config Next hosting                                       |
| Email      | SES SMTP                                                        | verification and password reset                                |

## One-time setup

The ordering matters a little: the bucket and database exist before the service that uses them.

1. **S3 bucket** `miscellary-media-prod`
   - Block public ACLs but allow bucket policies; apply `s3-bucket-policy.json` (public `GetObject`).
   - Apply `s3-cors.json` with the real web origin so the browser can `PUT` to presigned URLs.
2. **RDS PostgreSQL 16**, private subnet, one security group that only the App Runner VPC
   connector may reach on 5432. Note the connection URL:
   `postgres://USER:PASSWORD@HOST:5432/miscellary`.
3. **Secrets Manager**: `miscellary/secret-key`, `miscellary/database-url`, and the SES SMTP user and
   password. `python -c "import secrets; print(secrets.token_urlsafe(50))"` makes a good secret key.
4. **IAM**
   - `AppRunnerECRAccessRole`: the AWS-managed `AWSAppRunnerServicePolicyForECRAccess`.
   - `MiscellaryApiInstanceRole`: trust `tasks.apprunner.amazonaws.com`; attach
     `iam-instance-role-policy.json`. This is how the container reaches S3 and secrets with no
     access keys in the environment.
5. **ECR repository** `miscellary-api`, then a first image: `scripts/deploy-api.sh` builds and pushes.
6. **App Runner VPC connector** into the RDS subnets, then the service:
   ```bash
   aws apprunner create-service --cli-input-json file://infra/apprunner-service.json
   ```
   (copy `apprunner-service.example.json`, fill in ARNs and hostnames). The health check path
   is `/api/v1/health/`, which does a database round-trip, so a service only goes green once it
   can reach RDS.
7. **Custom domain** `api.example.com` on the App Runner service, so the web app and API share a
   site and the refresh cookie can stay `SameSite=Lax`. If they end up on unrelated domains set
   `COOKIE_SAMESITE=None` (see `docs/ADR-001-auth.md`).
8. **SES**: verify the sending domain, create SMTP credentials, and put them in the secrets above.
9. **Vercel**: import the repo, set _Root Directory_ to `apps/web`, and add
   `NEXT_PUBLIC_API_URL=https://api.example.com`. pnpm workspaces are detected automatically.
   Add the Vercel domain to `CORS_ALLOWED_ORIGINS` and `WEB_URL` on the App Runner service.
10. Create the first admin from a local shell against the production database:
    `DATABASE_URL=... DJANGO_SETTINGS_MODULE=config.settings.prod uv run python manage.py createsuperuser`.

## Every deploy

```bash
cp .env.deploy.example .env.deploy   # once
scripts/deploy-api.sh                # build → push → App Runner rolls out
```

Migrations run from the container entrypoint on start. Vercel deploys `main` on push.
`docs/RELEASE_CHECKLIST.md` has the pre-release list.

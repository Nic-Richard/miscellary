# Miscellary

Miscellary is a creative collecting platform for turning plants, rocks, records, sneakers, and
other interests into custom trading-card sets. People can publish sets, open daily packs,
trade duplicates, and build a public collection. The product is centered on creativity and
discovery rather than financial ownership or artificial scarcity.

## Features

- Draft and publish custom sets with image-based cards and configurable templates
- Design set covers, marks, pack artwork, typography, colors, and pack sizes
- Open one free pack per set each day, with an interactive foil tear and staged card reveal
- Recycle duplicate cards into set-specific points for additional packs
- Create multi-card trade offers, counters, and atomic exchanges
- Browse collections, profiles, showcases, comments, likes, follows, and search results
- Upload images directly to S3-compatible storage with presigned URLs
- Use the same Django API from the Next.js web client and Expo Android client

## Stack

- Next.js 15, React 19, and TypeScript for the web client
- Expo 53, React Native, and TypeScript for Android
- Django 5, Django REST Framework, and SimpleJWT for the API
- PostgreSQL for application data
- S3 in production and MinIO locally for image storage
- pnpm workspaces and Turborepo for JavaScript tooling
- uv, pytest, Ruff, and mypy for Python tooling
- Docker Compose for local development

## Repository structure

```text
apps/api/          Django REST API
apps/web/          Next.js web client
apps/mobile/       Expo Android client
packages/shared/   Shared API types, rarity rules, pack constants, and Markdown rules
packages/config/   Shared TypeScript and ESLint configuration
docker/            Application container definitions
infra/             App Runner, IAM, and S3 configuration examples
scripts/           Local development and deployment helpers
docs/              Product rules, API reference, design system, ADRs, and release checks
```

## Local development

### Docker Compose

The Docker workflow only requires Docker Engine with Compose. It installs the application
dependencies inside the containers, applies migrations, and starts PostgreSQL, MinIO, Django,
and Next.js.

```sh
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
cp apps/mobile/.env.example apps/mobile/.env
docker compose up --build
```

The web client runs at `http://localhost:3000`, the API at `http://localhost:8000`, the
interactive API documentation at `http://localhost:8000/api/v1/docs/`, and the MinIO console
at `http://localhost:9001` (`minioadmin` / `minioadmin`).

In another terminal, seed the database with demo users and content:

```sh
docker compose exec api uv run python manage.py seed_demo
```

The seed command is safe to repeat. It recreates only its demo users and their related content.
Pass `--no-photos` to use generated placeholders instead of downloading Wikimedia Commons
images.

All seeded users use the password `demopass123`. The main accounts are
`fieldnote@example.com`, `waverly@example.com`, and `mabel@example.com`; additional accounts
use `orla`, `kit`, `bex`, `sol`, or `wren` followed by `@example.com`.

### Host-native development

Running the application processes outside Docker requires:

- Node.js 22 and pnpm (`corepack enable`)
- Python 3.12 and [uv](https://docs.astral.sh/uv/)
- PostgreSQL 16 and MinIO, either locally or through Docker

```sh
pnpm install --frozen-lockfile
docker compose up -d db minio minio-init

cd apps/api
cp .env.example .env
uv sync --frozen
uv run python manage.py migrate
uv run python manage.py runserver  # http://localhost:8000

cd ../web
cp .env.example .env
pnpm dev                          # http://localhost:3000
```

Verification and password-reset messages are written to the API console in development.

For host-native development, seed from `apps/api`:

```sh
uv run python manage.py seed_demo
```

## Environment variables

Each app includes a committed `.env.example`. Real environment files are ignored.

### API

| Variable                                                             | Purpose                                                                                                          |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `DJANGO_SETTINGS_MODULE`                                             | Optional explicit settings override; management commands default to development and pytest selects test settings |
| `SECRET_KEY`                                                         | Django secret key, required in production                                                                        |
| `DATABASE_URL`                                                       | PostgreSQL connection URL                                                                                        |
| `ALLOWED_HOSTS`                                                      | Comma-separated API hostnames                                                                                    |
| `CORS_ALLOWED_ORIGINS`                                               | Browser origins allowed to call the API with credentials                                                         |
| `CSRF_TRUSTED_ORIGINS`                                               | Trusted browser origins for cookie-authenticated requests                                                        |
| `WEB_URL`                                                            | Base URL used in emailed links                                                                                   |
| `EMAIL_FROM`                                                         | Sender address for application email                                                                             |
| `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD` | SMTP configuration                                                                                               |
| `COOKIE_SECURE`                                                      | Enables HTTPS-only refresh cookies                                                                               |
| `COOKIE_SAMESITE`                                                    | Refresh-cookie SameSite policy                                                                                   |
| `AWS_S3_ENDPOINT_URL`                                                | Internal S3-compatible endpoint; points to MinIO locally                                                         |
| `AWS_S3_PUBLIC_ENDPOINT_URL`                                         | Browser-reachable upload endpoint when it differs from the internal endpoint                                     |
| `AWS_STORAGE_BUCKET_NAME`                                            | Image bucket name                                                                                                |
| `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_S3_REGION`        | S3-compatible storage credentials                                                                                |
| `MEDIA_PUBLIC_URL`                                                   | Public base URL for uploaded images                                                                              |

### Web and mobile

| App    | Variable              | Purpose                                                      |
| ------ | --------------------- | ------------------------------------------------------------ |
| Web    | `NEXT_PUBLIC_API_URL` | API base URL                                                 |
| Mobile | `EXPO_PUBLIC_API_URL` | API base URL; Android emulators reach the host at `10.0.2.2` |

## Commands

With the Docker stack running, the complete backend validation uses ordinary container commands:

```sh
docker compose exec api uv run ruff check .
docker compose exec api uv run ruff format --check .
docker compose exec api uv run mypy .
docker compose exec api uv run pytest
docker compose exec api uv run python manage.py check
docker compose exec api uv run python manage.py makemigrations --check --dry-run
```

Frontend and shared-package validation runs from the repository root:

```sh
pnpm install --frozen-lockfile
pnpm format:check
pnpm turbo run lint typecheck test
pnpm build
```

`pnpm build` creates the Next.js production build and the Expo Android export. Developers with
Node.js and pnpm can run the frontend checks and builds without host Python. Developers who also
have Python, uv, and GNU Make installed can run `make check` for the same local checks and builds.
CI runs the equivalent commands for pushes and pull requests.

## Architecture and deployment

Django owns authentication and issues short-lived access tokens with rotating, blacklisted
refresh tokens. The web client receives its refresh token in an HttpOnly cookie. The mobile
client stores its refresh token in SecureStore. Uploads go directly from clients to
S3-compatible storage through presigned URLs.

The production target is Vercel for the web client and AWS App Runner, RDS PostgreSQL, S3, and
SES for the API and supporting services. See [`infra/README.md`](infra/README.md) for setup and
deployment details.

Additional project documentation is indexed in [`docs/README.md`](docs/README.md).

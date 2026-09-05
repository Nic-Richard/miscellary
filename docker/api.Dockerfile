FROM python:3.12-slim AS base
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 UV_LINK_MODE=copy
COPY --from=ghcr.io/astral-sh/uv:0.8 /uv /uvx /bin/
WORKDIR /app

# Local development uses the repository layout so backend tests can read shared fixtures.
FROM base AS dev
WORKDIR /repo/apps/api
COPY apps/api/pyproject.toml apps/api/uv.lock ./
RUN uv sync --frozen --no-install-project
COPY apps/api/ .

# Production: the image App Runner runs. Migrations run from the entrypoint.
FROM base AS prod
COPY apps/api/pyproject.toml apps/api/uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project
COPY apps/api/ .
COPY docker/api-entrypoint.sh /entrypoint.sh
ENV DJANGO_SETTINGS_MODULE=config.settings.prod PATH="/app/.venv/bin:$PATH"
RUN SECRET_KEY=build DATABASE_URL=sqlite:///build.db python manage.py collectstatic --noinput \
    && adduser --disabled-password --gecos "" app && chown -R app:app /app
USER app
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/v1/health/')"
ENTRYPOINT ["/entrypoint.sh"]

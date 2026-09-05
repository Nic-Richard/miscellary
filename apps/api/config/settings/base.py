from datetime import timedelta
from pathlib import Path

from corsheaders.defaults import default_headers
from environs import Env

BASE_DIR = Path(__file__).resolve().parent.parent.parent

env = Env()
env.read_env(BASE_DIR / ".env", recurse=False)

# Dev/test fall back to an insecure key; prod.py requires a real one.
SECRET_KEY = env.str("SECRET_KEY", default="insecure-dev-key-long-enough-for-hmac-sha256")
DEBUG = False

# Accounts exempt from the one-free-pack-per-day rule, for testing only. Empty
# everywhere except local development; see config/settings/dev.py.
UNLIMITED_PACK_EMAILS: list[str] = env.list("UNLIMITED_PACK_EMAILS", default=[])
ALLOWED_HOSTS = env.list("ALLOWED_HOSTS", default=["localhost", "127.0.0.1"])

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "django.contrib.postgres",
    "rest_framework",
    "rest_framework_simplejwt.token_blacklist",
    "corsheaders",
    "drf_spectacular",
    "common",
    "accounts",
    "uploads",
    "cards",
    "packs",
    "trades",
    "social",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    # Serves the admin's static files from the container; there is no separate static host.
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

DATABASES = {
    "default": env.dj_db_url(
        "DATABASE_URL", default="postgres://miscellary:miscellary@localhost:5432/miscellary"
    )
}
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

AUTH_USER_MODEL = "accounts.User"
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {"BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage"},
}

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.IsAuthenticated"],
    "DEFAULT_RENDERER_CLASSES": ["rest_framework.renderers.JSONRenderer"],
    "DEFAULT_PARSER_CLASSES": ["rest_framework.parsers.JSONParser"],
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "EXCEPTION_HANDLER": "common.exceptions.exception_handler",
    "DEFAULT_THROTTLE_CLASSES": ["rest_framework.throttling.ScopedRateThrottle"],
    "DEFAULT_THROTTLE_RATES": {
        "auth.login": "10/min",
        "auth.register": "5/min",
        "auth.email": "5/min",
        "uploads": "60/min",
        "packs": "30/min",
        "reports": "10/hour",
        "comments": "20/hour",
    },
}

REFRESH_TOKEN_LIFETIME = timedelta(days=30)

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=15),
    "REFRESH_TOKEN_LIFETIME": REFRESH_TOKEN_LIFETIME,
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "UPDATE_LAST_LOGIN": True,
    "AUTH_HEADER_TYPES": ("Bearer",),
    "USER_ID_FIELD": "id",
    "USER_ID_CLAIM": "sub",
}

# Plain APIViews can't declare a response serializer per method; the docs still render.
SILENCED_SYSTEM_CHECKS = ["drf_spectacular.W002"]

SPECTACULAR_SETTINGS = {
    "TITLE": "Miscellary API",
    "VERSION": "0.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
}

CORS_ALLOWED_ORIGINS = env.list("CORS_ALLOWED_ORIGINS", default=["http://localhost:3000"])
CORS_ALLOW_CREDENTIALS = True
CORS_ALLOW_HEADERS = [*default_headers, "x-client-platform"]

# Refresh token cookie for web clients. Mobile receives the token in the body.
REFRESH_COOKIE_NAME = "miscellary_refresh"
REFRESH_COOKIE_PATH = "/api/v1/auth"
REFRESH_COOKIE_MAX_AGE = int(REFRESH_TOKEN_LIFETIME.total_seconds())
REFRESH_COOKIE_SECURE = env.bool("COOKIE_SECURE", default=True)
# "Lax" works when web and API share a site (app.example.com + api.example.com).
# If they live on unrelated domains the browser only sends the cookie with "None".
REFRESH_COOKIE_SAMESITE = env.str("COOKIE_SAMESITE", default="Lax")

WEB_URL = env.str("WEB_URL", default="http://localhost:3000")
DEFAULT_FROM_EMAIL = env.str("EMAIL_FROM", default="Miscellary <no-reply@localhost>")
EMAIL_VERIFICATION_MAX_AGE = timedelta(days=2)
PASSWORD_RESET_TIMEOUT = int(timedelta(hours=2).total_seconds())

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {"console": {"class": "logging.StreamHandler"}},
    "root": {"handlers": ["console"], "level": "INFO"},
}

# Object storage: MinIO locally, S3 in production. Uploads go straight from the
# browser to the bucket with presigned URLs; the API never proxies image bytes.
AWS_S3_ENDPOINT_URL = env.str("AWS_S3_ENDPOINT_URL", default="")
# The endpoint a browser can reach, when that differs from the one the API
# uses. In Docker the API talks to MinIO as "minio:9000", which means nothing
# outside the compose network, so a URL presigned against it is unusable by
# the browser doing the upload. Empty in production, where both are S3.
AWS_S3_PUBLIC_ENDPOINT_URL = env.str("AWS_S3_PUBLIC_ENDPOINT_URL", default="")
AWS_S3_REGION = env.str("AWS_S3_REGION", default="us-east-1")
AWS_STORAGE_BUCKET_NAME = env.str("AWS_STORAGE_BUCKET_NAME", default="miscellary-media")
AWS_ACCESS_KEY_ID = env.str("AWS_ACCESS_KEY_ID", default="")
AWS_SECRET_ACCESS_KEY = env.str("AWS_SECRET_ACCESS_KEY", default="")
MEDIA_PUBLIC_URL = env.str("MEDIA_PUBLIC_URL", default="http://localhost:9000/miscellary-media")

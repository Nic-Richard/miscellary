from .base import *  # noqa: F403
from .base import env

DEBUG = False
SECRET_KEY = env.str("SECRET_KEY")
database_url = env.str("DATABASE_URL", default="")
if database_url:
    DATABASES = {"default": env.dj_db_url("DATABASE_URL", conn_max_age=60)}
else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.postgresql",
            "HOST": env.str("DB_HOST"),
            "PORT": env.int("DB_PORT", default=5432),
            "NAME": env.str("DB_NAME"),
            "USER": env.str("DB_USER"),
            "PASSWORD": env.str("DB_PASSWORD"),
            "CONN_MAX_AGE": 60,
        }
    }
DATABASES["default"].setdefault("OPTIONS", {}).setdefault(
    "sslmode", env.str("DATABASE_SSLMODE", default="require")
)

ALLOWED_HOSTS = env.list("ALLOWED_HOSTS")
CORS_ALLOWED_ORIGINS = env.list("CORS_ALLOWED_ORIGINS")
CSRF_TRUSTED_ORIGINS: list[str] = env.list("CSRF_TRUSTED_ORIGINS")
WEB_URL = env.str("WEB_URL")
DEFAULT_FROM_EMAIL = env.str("EMAIL_FROM")

AWS_S3_REGION = env.str("AWS_S3_REGION")
AWS_STORAGE_BUCKET_NAME = env.str("AWS_STORAGE_BUCKET_NAME")
MEDIA_PUBLIC_URL = env.str("MEDIA_PUBLIC_URL")
MEDIA_SOURCE_URLS_SIGNED = True

EMAIL_HOST = env.str("EMAIL_HOST")
EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"
EMAIL_PORT = env.int("EMAIL_PORT", default=587)
EMAIL_USE_TLS = True
EMAIL_HOST_USER = env.str("EMAIL_HOST_USER")
EMAIL_HOST_PASSWORD = env.str("EMAIL_HOST_PASSWORD")
EMAIL_TIMEOUT = env.int("EMAIL_TIMEOUT", default=10)

# The load balancer owns the HTTP redirect and forwards HTTPS requests to the task.
# Redirecting again in Django would also redirect its internal health checks.
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SECURE_SSL_REDIRECT = False
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_HSTS_SECONDS = 60 * 60 * 24 * 30
SECURE_HSTS_INCLUDE_SUBDOMAINS = True

from .base import *  # noqa: F403
from .base import env

DEBUG = False
SECRET_KEY = env.str("SECRET_KEY")
DATABASES = {"default": env.dj_db_url("DATABASE_URL", conn_max_age=60)}

# SES (or any SMTP relay). Leave EMAIL_HOST empty to log emails to the console instead.
EMAIL_HOST = env.str("EMAIL_HOST", default="")
EMAIL_BACKEND = (
    "django.core.mail.backends.smtp.EmailBackend"
    if EMAIL_HOST
    else "django.core.mail.backends.console.EmailBackend"
)
EMAIL_PORT = env.int("EMAIL_PORT", default=587)
EMAIL_USE_TLS = True
EMAIL_HOST_USER = env.str("EMAIL_HOST_USER", default="")
EMAIL_HOST_PASSWORD = env.str("EMAIL_HOST_PASSWORD", default="")

# App Runner terminates TLS and forwards X-Forwarded-Proto. Its health checks hit the
# container over plain HTTP, so a blanket SSL redirect would fail them.
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SECURE_SSL_REDIRECT = False
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_HSTS_SECONDS = 60 * 60 * 24 * 30
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
CSRF_TRUSTED_ORIGINS: list[str] = env.list("CSRF_TRUSTED_ORIGINS", default=[])

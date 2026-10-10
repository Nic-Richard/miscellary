from .base import *  # noqa: F403
from .base import env

SECRET_KEY = "test-secret-key-long-enough-for-hmac-sha256-0000"
DATABASES = {
    "default": env.dj_db_url(
        "TEST_DATABASE_URL", default="postgres://miscellary:miscellary@localhost:5432/miscellary"
    )
}
EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"
PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]
REFRESH_COOKIE_SECURE = False
# Tests opt into features explicitly and must never inherit provider credentials.
MONETIZATION_ENABLED = False
MONETIZATION_PREVIEW = False
LOUNGE_ENABLED = False
STRIPE_CHECKOUT_ENABLED = False
STRIPE_LIVE_APPROVED = False
STRIPE_SECRET_KEY = ""
STRIPE_WEBHOOK_SECRET = ""
STRIPE_PRICE_IDS = {}
STRIPE_PORTAL_CONFIGURATION = ""
PLAY_BILLING_ENABLED = False
PLAY_LIVE_APPROVED = False
PLAY_SERVICE_ACCOUNT = ""
PLAY_RTDN_AUDIENCE = ""
PLAY_RTDN_SERVICE_ACCOUNT = ""
REST_FRAMEWORK = {**REST_FRAMEWORK, "DEFAULT_THROTTLE_CLASSES": []}  # noqa: F405

AWS_S3_ENDPOINT_URL = ""
# Pinned like the one above: tests presign against S3 itself, never a local
# endpoint that happens to be in the environment.
AWS_S3_PUBLIC_ENDPOINT_URL = ""
AWS_ACCESS_KEY_ID = "testing"
AWS_SECRET_ACCESS_KEY = "testing"
AWS_STORAGE_BUCKET_NAME = "test-bucket"
MEDIA_PUBLIC_URL = "https://media.test/test-bucket"

# Static files are only collected for the production image.
STORAGES["staticfiles"] = {  # noqa: F405
    "BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"
}
WHITENOISE_AUTOREFRESH = True

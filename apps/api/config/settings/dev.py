from .base import *  # noqa: F403

DEBUG = True
EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"
REFRESH_COOKIE_SECURE = False
STORAGES["staticfiles"] = {  # noqa: F405
    "BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"
}
WHITENOISE_AUTOREFRESH = True

# Seeded demo accounts can open packs repeatedly so the reveal is testable.
UNLIMITED_PACK_EMAILS = [
    "fieldnote@example.com",
    "waverly@example.com",
    "mabel@example.com",
    "orla@example.com",
    "kit@example.com",
    "bex@example.com",
    "sol@example.com",
    "wren@example.com",
]

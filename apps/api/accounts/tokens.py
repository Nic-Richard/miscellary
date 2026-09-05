"""Signed, expiring tokens for email verification and password reset.

Both flows avoid a database table: the token carries the user id and a stamp
that becomes invalid once the underlying state changes.
"""

from django.conf import settings
from django.contrib.auth.tokens import PasswordResetTokenGenerator
from django.core import signing

from .models import User

EMAIL_VERIFY_SALT = "accounts.email-verify"


def make_email_verification_token(user: User) -> str:
    return signing.dumps({"uid": str(user.id), "email": user.email}, salt=EMAIL_VERIFY_SALT)


def read_email_verification_token(token: str) -> User | None:
    try:
        data = signing.loads(
            token, salt=EMAIL_VERIFY_SALT, max_age=settings.EMAIL_VERIFICATION_MAX_AGE
        )
    except signing.BadSignature:
        return None
    return User.objects.filter(id=data.get("uid"), email=data.get("email")).first()


password_reset_tokens = PasswordResetTokenGenerator()

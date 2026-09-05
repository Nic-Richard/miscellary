from django.conf import settings
from django.core.mail import send_mail
from django.utils.http import urlsafe_base64_encode

from .models import User
from .tokens import make_email_verification_token, password_reset_tokens


def send_verification_email(user: User) -> None:
    token = make_email_verification_token(user)
    link = f"{settings.WEB_URL}/verify-email?token={token}"
    send_mail(
        subject="Verify your Miscellary email",
        message=f"Hi @{user.username},\n\nConfirm your email address:\n{link}\n",
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[user.email],
    )


def send_password_reset_email(user: User) -> None:
    uid = urlsafe_base64_encode(str(user.id).encode())
    token = password_reset_tokens.make_token(user)
    link = f"{settings.WEB_URL}/reset-password?uid={uid}&token={token}"
    send_mail(
        subject="Reset your Miscellary password",
        message=(
            f"Hi @{user.username},\n\nReset your password:\n{link}\n\n"
            "If you didn't ask for this, ignore this email.\n"
        ),
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[user.email],
    )

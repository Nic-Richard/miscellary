from django.conf import settings
from django.core.mail import send_mail
from django.template.loader import render_to_string
from django.utils.http import urlsafe_base64_encode

from .models import User
from .tokens import make_email_verification_token, password_reset_tokens


def _send(user: User, subject: str, intro: str, action: str, link: str, outro: str = "") -> None:
    context = {
        "subject": subject,
        "username": user.username,
        "intro": intro,
        "action": action,
        "link": link,
        "outro": outro,
    }
    text = f"Hi @{user.username},\n\n{intro}\n\n{action}:\n{link}\n"
    if outro:
        text += f"\n{outro}\n"
    send_mail(
        subject=subject,
        message=text,
        html_message=render_to_string("accounts/email.html", context),
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[user.email],
    )


def send_verification_email(user: User) -> None:
    token = make_email_verification_token(user)
    _send(
        user,
        subject="Verify your Miscellary email",
        intro=(
            "Confirm this is your email address so you can publish sets and trade cards. "
            f"The link works for {settings.EMAIL_VERIFICATION_MAX_AGE.days} days."
        ),
        action="Verify email",
        link=f"{settings.WEB_URL}/verify-email?token={token}",
        outro="If you didn't create a Miscellary account, ignore this email.",
    )


def send_password_reset_email(user: User) -> None:
    uid = urlsafe_base64_encode(str(user.id).encode())
    token = password_reset_tokens.make_token(user)
    _send(
        user,
        subject="Reset your Miscellary password",
        intro=(
            "Someone asked to reset the password for your account. The link works once, "
            f"for {settings.PASSWORD_RESET_TIMEOUT // 3600} hours."
        ),
        action="Choose a new password",
        link=f"{settings.WEB_URL}/reset-password?uid={uid}&token={token}",
        outro="If you didn't ask for this, ignore this email and your password stays the same.",
    )

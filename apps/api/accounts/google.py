import hashlib
import secrets
from dataclasses import dataclass
from datetime import timedelta

import jwt
from django.conf import settings
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.validators import validate_email
from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework.exceptions import APIException, AuthenticationFailed, ValidationError
from rest_framework.request import Request

from . import cookies
from .models import USERNAME_VALIDATOR, GoogleChallenge, GoogleIdentity, User, username_taken

CHALLENGE_LIFETIME = timedelta(minutes=5)
CHALLENGE_COOKIE = "miscellary_google"
_keys = jwt.PyJWKClient("https://www.googleapis.com/oauth2/v3/certs", timeout=5)


class SignupRequired(APIException):
    status_code = 409
    default_detail = "Choose a username to create your account."
    error_code = "google_signup_required"


def check_request(request: Request, nonce: str | None = None) -> None:
    if cookies.client_platform(request) == cookies.MOBILE:
        return
    if request.headers.get("Origin") not in settings.CORS_ALLOWED_ORIGINS:
        raise AuthenticationFailed("Google confirmation must start from Miscellary.")
    if nonce is not None:
        bound = request.COOKIES.get(CHALLENGE_COOKIE, "")
        if not nonce or not secrets.compare_digest(bound.encode(), nonce.encode()):
            raise AuthenticationFailed("Google confirmation belongs to another browser session.")


@dataclass(frozen=True)
class GoogleAccount:
    subject: str
    email: str
    email_authoritative: bool


def _digest(nonce: str) -> str:
    return hashlib.sha256(nonce.encode()).hexdigest()


def issue_challenge(purpose: str, user: User | None = None) -> str:
    if not settings.GOOGLE_CLIENT_IDS:
        raise ValidationError("Google sign-in is not configured.")
    if purpose not in GoogleChallenge.Purpose.values:
        raise ValidationError("Invalid Google confirmation.")
    if purpose != GoogleChallenge.Purpose.LOGIN and (user is None or not user.is_active):
        raise AuthenticationFailed("Log in before connecting or confirming Google.")
    if purpose == GoogleChallenge.Purpose.LOGIN and user is not None:
        raise ValidationError("Login confirmations cannot belong to an existing session.")
    nonce = secrets.token_urlsafe(32)
    now = timezone.now()
    GoogleChallenge.objects.filter(expires_at__lte=now).delete()
    GoogleChallenge.objects.create(
        digest=_digest(nonce), purpose=purpose, user=user, expires_at=now + CHALLENGE_LIFETIME
    )
    return nonce


def verify_credential(credential: str, nonce: str) -> GoogleAccount:
    if not settings.GOOGLE_CLIENT_IDS:
        raise ValidationError("Google sign-in is not configured.")
    if not isinstance(credential, str) or not 1 <= len(credential) <= 8192:
        raise AuthenticationFailed("Google confirmation is invalid.")
    if not isinstance(nonce, str) or len(nonce) != 43 or not nonce.isascii():
        raise AuthenticationFailed("Google confirmation is invalid.")
    try:
        # Never accept an algorithm or key URL supplied by the credential.
        if jwt.get_unverified_header(credential).get("alg") != "RS256":
            raise jwt.InvalidTokenError()
        key = _keys.get_signing_key_from_jwt(credential)
        claims = jwt.decode(
            credential,
            key.key,
            algorithms=["RS256"],
            audience=settings.GOOGLE_CLIENT_IDS,
            issuer=["https://accounts.google.com", "accounts.google.com"],
            options={"require": ["sub", "email", "email_verified", "nonce", "iat", "exp"]},
        )
    except jwt.PyJWKClientConnectionError as exc:
        raise ValidationError("Google could not be reached. Please try again.") from exc
    except jwt.PyJWTError as exc:
        raise AuthenticationFailed("Google confirmation is invalid or expired.") from exc
    if (
        not isinstance(claims["nonce"], str)
        or not claims["nonce"].isascii()
        or not secrets.compare_digest(claims["nonce"], nonce)
    ):
        raise AuthenticationFailed("Google confirmation does not match this request.")
    if claims["email_verified"] is not True:
        raise AuthenticationFailed("Google has not verified this email.")
    subject, email = claims["sub"], claims["email"]
    if not isinstance(subject, str) or not 1 <= len(subject) <= 255:
        raise AuthenticationFailed("Google confirmation is invalid.")
    if not isinstance(email, str) or len(email) > 254:
        raise AuthenticationFailed("Google confirmation is invalid.")
    email = email.lower()
    try:
        validate_email(email)
    except DjangoValidationError as exc:
        raise AuthenticationFailed("Google confirmation is invalid.") from exc
    authoritative = email.endswith("@gmail.com") or bool(claims.get("hd"))
    return GoogleAccount(subject=subject, email=email, email_authoritative=authoritative)


def _consume_challenge(nonce: str, purpose: str, user: User | None = None) -> None:
    challenge = GoogleChallenge.objects.select_for_update().filter(digest=_digest(nonce)).first()
    if (
        challenge is None
        or challenge.expires_at <= timezone.now()
        or challenge.purpose != purpose
        or challenge.user_id != (user.pk if user else None)
    ):
        raise AuthenticationFailed("Google confirmation has expired or was already used.")
    challenge.delete()


def login(credential: str, nonce: str) -> User:
    account = verify_credential(credential, nonce)
    with transaction.atomic():
        _consume_challenge(nonce, GoogleChallenge.Purpose.LOGIN)
        identity = GoogleIdentity.objects.filter(subject=account.subject).first()
        if identity is None:
            # An email match is not permission to take over or merge an account.
            if User.objects.filter(email=account.email).exists():
                raise ValidationError(
                    "Log in to your existing account and connect Google in settings."
                )
            raise SignupRequired()
        user = User.objects.select_for_update().get(pk=identity.user_id)
        if not user.is_active:
            raise AuthenticationFailed("Account is unavailable.")
        return user


def register(credential: str, nonce: str, username: str, terms_accepted: bool) -> User:
    if terms_accepted is not True:
        raise ValidationError({"terms_accepted": ["Accept the terms before creating an account."]})
    username = username.strip().lower()
    try:
        USERNAME_VALIDATOR(username)
    except DjangoValidationError as exc:
        raise ValidationError({"username": exc.messages}) from exc
    if username_taken(username):
        raise ValidationError({"username": ["That username is taken."]})
    account = verify_credential(credential, nonce)
    if not account.email_authoritative:
        raise ValidationError(
            "For this email address, sign up with email and password, verify your email, "
            "then connect Google in settings."
        )
    try:
        with transaction.atomic():
            _consume_challenge(nonce, GoogleChallenge.Purpose.LOGIN)
            if (
                GoogleIdentity.objects.filter(subject=account.subject).exists()
                or User.objects.filter(email=account.email).exists()
            ):
                raise ValidationError("An account already exists. Log in before connecting Google.")
            user = User.objects.create_user(
                email=account.email,
                username=username,
                password=None,
                email_verified=account.email_authoritative,
            )
            GoogleIdentity.objects.create(user=user, subject=account.subject)
            return user
    except IntegrityError as exc:
        raise ValidationError("That username or account was just taken. Please try again.") from exc


def link(credential: str, nonce: str, user: User, current_password: str) -> None:
    account = verify_credential(credential, nonce)
    try:
        with transaction.atomic():
            _consume_challenge(nonce, GoogleChallenge.Purpose.LINK, user)
            current = User.objects.select_for_update().get(pk=user.pk)
            if not current.is_active or not current.check_password(current_password):
                raise AuthenticationFailed("Current password is incorrect or account unavailable.")
            if not current.email_verified:
                raise ValidationError("Verify your Miscellary email before connecting Google.")
            identity = GoogleIdentity.objects.filter(user=current).first()
            if identity is not None:
                raise ValidationError("Google is already connected to this account.")
            GoogleIdentity.objects.create(user=current, subject=account.subject)
    except IntegrityError as exc:
        raise ValidationError("This Google account is already connected.") from exc


def confirm(credential: str, nonce: str, purpose: str, user: User) -> None:
    if purpose not in {
        GoogleChallenge.Purpose.USERNAME,
        GoogleChallenge.Purpose.PASSWORD,
        GoogleChallenge.Purpose.DELETE,
    }:
        raise ValidationError("Invalid Google confirmation.")
    account = verify_credential(credential, nonce)
    with transaction.atomic():
        _consume_challenge(nonce, purpose, user)
        current = User.objects.select_for_update().get(pk=user.pk)
        if (
            not current.is_active
            or not GoogleIdentity.objects.filter(user=current, subject=account.subject).exists()
        ):
            raise AuthenticationFailed("Choose the Google account connected to this account.")


@transaction.atomic
def disconnect(user: User, current_password: str) -> None:
    current = User.objects.select_for_update().get(pk=user.pk)
    if not current.is_active:
        raise AuthenticationFailed("Account is unavailable.")
    if not current.has_usable_password():
        raise ValidationError("Set a password before disconnecting Google so you can still log in.")
    if not current.check_password(current_password):
        raise AuthenticationFailed("Current password is incorrect.")
    GoogleIdentity.objects.filter(user=current).delete()
    GoogleChallenge.objects.filter(user=current).delete()

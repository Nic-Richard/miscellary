import contextlib
import logging

from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import IntegrityError, transaction
from django.utils import timezone
from django.utils.http import urlsafe_base64_decode
from rest_framework import permissions, status
from rest_framework.exceptions import AuthenticationFailed, ValidationError
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken

from . import cookies, emails
from .lifecycle import delete_account, revoke_sessions
from .models import ReservedUsername, User
from .serializers import (
    ChangePasswordSerializer,
    ConfirmPasswordSerializer,
    CurrentUserSerializer,
    EmailSerializer,
    LoginSerializer,
    PasswordResetConfirmSerializer,
    ProfileUpdateSerializer,
    RegisterSerializer,
    TokenSerializer,
    UsernameChangeSerializer,
    cooldown_error,
)
from .tokens import password_reset_tokens, read_email_verification_token

logger = logging.getLogger(__name__)


def _current_user(request: Request) -> User:
    # IsAuthenticated has already run; this narrows the type for mypy.
    assert isinstance(request.user, User)
    return request.user


def _session_response(
    request: Request, user: User, http_status: int = status.HTTP_200_OK
) -> Response:
    refresh = RefreshToken.for_user(user)
    response = Response({"user": CurrentUserSerializer(user).data}, status=http_status)
    return cookies.attach_tokens(request, response, str(refresh.access_token), str(refresh))


class RegisterView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_scope = "auth.register"

    def post(self, request: Request) -> Response:
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        with transaction.atomic():
            user = serializer.save()
        # The account stands without the email; the collector can ask for another link.
        try:
            emails.send_verification_email(user)
        except Exception:
            logger.exception("Verification email failed for %s", user.pk)
        return _session_response(request, user, status.HTTP_201_CREATED)


class LoginView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_scope = "auth.login"

    def post(self, request: Request) -> Response:
        serializer = LoginSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        return _session_response(request, serializer.validated_data["user"])


class RefreshView(APIView):
    """Rotate the refresh token and issue a new access token."""

    permission_classes = [permissions.AllowAny]

    def post(self, request: Request) -> Response:
        raw = cookies.incoming_refresh_token(request)
        if not raw:
            raise AuthenticationFailed("No refresh token.")
        try:
            old = RefreshToken(raw)  # type: ignore[arg-type]
        except TokenError as exc:
            raise AuthenticationFailed("Refresh token is invalid or expired.") from exc

        user = User.objects.filter(id=old["sub"], is_active=True).first()
        if user is None:
            raise AuthenticationFailed("Account is unavailable.")

        old.blacklist()
        new = RefreshToken.for_user(user)
        response = Response({})
        return cookies.attach_tokens(request, response, str(new.access_token), str(new))


class LogoutView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request: Request) -> Response:
        raw = cookies.incoming_refresh_token(request)
        if raw:
            with contextlib.suppress(TokenError):
                RefreshToken(raw).blacklist()  # type: ignore[arg-type]
        response = Response(status=status.HTTP_204_NO_CONTENT)
        cookies.clear_refresh_cookie(response)
        return response


class MeView(APIView):
    def get(self, request: Request) -> Response:
        return Response(CurrentUserSerializer(_current_user(request)).data)

    def patch(self, request: Request) -> Response:
        user = _current_user(request)
        serializer = ProfileUpdateSerializer(user.profile, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(CurrentUserSerializer(user).data)


class ChangeUsernameView(APIView):
    """Take a new username, and keep the old one from being claimed.

    The vacated name is reserved for this account rather than returned to the
    pool, because profile links carry usernames. The reservation lasts until the
    next change replaces it, so one account holds one former name.
    """

    throttle_scope = "auth.username"

    def post(self, request: Request) -> Response:
        serializer = UsernameChangeSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        wanted = serializer.validated_data["username"]
        current = _current_user(request)
        try:
            with transaction.atomic():
                # Recheck the cooldown under the row lock.
                user = User.objects.select_for_update().get(pk=current.pk)
                cooldown_error(user)
                previous = user.username
                if previous == wanted:
                    raise ValidationError({"username": ["That is already your username."]})
                ReservedUsername.objects.filter(user=user).delete()
                user.username = wanted
                user.username_changed_at = timezone.now()
                user.save(update_fields=["username", "username_changed_at"])
                ReservedUsername.objects.create(user=user, username=previous)
        except IntegrityError:
            raise ValidationError({"username": ["That username was just taken."]}) from None
        # Keep request.user in sync with the locked row.
        current.username = user.username
        current.username_changed_at = user.username_changed_at
        return Response(CurrentUserSerializer(user).data)


class ChangePasswordView(APIView):
    def post(self, request: Request) -> Response:
        serializer = ChangePasswordSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        user = _current_user(request)
        user.set_password(serializer.validated_data["new_password"])
        user.save(update_fields=["password"])
        revoke_sessions(user)
        return _session_response(request, user)


class DeleteAccountView(APIView):
    throttle_scope = "auth.login"

    def post(self, request: Request) -> Response:
        serializer = ConfirmPasswordSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        delete_account(_current_user(request))
        response = Response(status=status.HTTP_204_NO_CONTENT)
        cookies.clear_refresh_cookie(response)
        return response


class EmailVerificationRequestView(APIView):
    throttle_scope = "auth.email"

    def post(self, request: Request) -> Response:
        user = _current_user(request)
        if not user.email_verified:
            emails.send_verification_email(user)
        return Response(status=status.HTTP_204_NO_CONTENT)


class EmailVerificationConfirmView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request: Request) -> Response:
        serializer = TokenSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = read_email_verification_token(serializer.validated_data["token"])
        if user is None:
            raise ValidationError({"token": ["This verification link is invalid or has expired."]})
        if not user.email_verified:
            user.email_verified = True
            user.save(update_fields=["email_verified"])
        return Response(status=status.HTTP_204_NO_CONTENT)


class PasswordResetRequestView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_scope = "auth.email"

    def post(self, request: Request) -> Response:
        serializer = EmailSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = User.objects.filter(
            email=serializer.validated_data["email"].lower(), is_active=True
        ).first()
        # Always 204 so the endpoint cannot be used to probe for accounts.
        if user is not None:
            emails.send_password_reset_email(user)
        return Response(status=status.HTTP_204_NO_CONTENT)


class PasswordResetConfirmView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request: Request) -> Response:
        serializer = PasswordResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        try:
            user_id = urlsafe_base64_decode(data["uid"]).decode()
            user = User.objects.get(id=user_id, is_active=True)
        except (ValueError, User.DoesNotExist, DjangoValidationError) as exc:
            raise ValidationError(
                {"token": ["This reset link is invalid or has expired."]}
            ) from exc
        if not password_reset_tokens.check_token(user, data["token"]):
            raise ValidationError({"token": ["This reset link is invalid or has expired."]})
        try:
            validate_password(data["password"], user=user)
        except DjangoValidationError as exc:
            raise ValidationError({"password": exc.messages}) from exc
        user.set_password(data["password"])
        user.save(update_fields=["password"])
        revoke_sessions(user)
        return Response(status=status.HTTP_204_NO_CONTENT)

from datetime import timedelta

from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.utils import timezone
from rest_framework import serializers

from . import google
from .models import (
    USERNAME_COOLDOWN_DAYS,
    USERNAME_VALIDATOR,
    GoogleChallenge,
    GoogleIdentity,
    Profile,
    User,
    username_taken,
)


class ProfileSerializer(serializers.ModelSerializer[Profile]):
    username = serializers.CharField(source="user.username", read_only=True)
    created_at = serializers.DateTimeField(source="user.created_at", read_only=True)
    avatar_url = serializers.CharField(read_only=True)
    is_demo = serializers.BooleanField(source="user.is_demo", read_only=True)

    class Meta:
        model = Profile
        fields = [
            "username",
            "display_name",
            "bio",
            "showcase_title",
            "binder_colour",
            "avatar_url",
            "is_demo",
            "created_at",
        ]


class CurrentUserSerializer(serializers.ModelSerializer[User]):
    profile = ProfileSerializer(read_only=True)
    username_change_available_at = serializers.SerializerMethodField()
    has_password = serializers.SerializerMethodField()
    google_connected = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "email",
            "email_verified",
            "username_change_available_at",
            "profile",
            "has_password",
            "google_connected",
            "theme",
        ]
        read_only_fields = fields

    def get_username_change_available_at(self, obj: User) -> str | None:
        return username_change_available_at(obj)

    def get_has_password(self, obj: User) -> bool:
        return obj.has_usable_password()

    def get_google_connected(self, obj: User) -> bool:
        return GoogleIdentity.objects.filter(user=obj).exists()


class RegisterSerializer(serializers.Serializer[User]):
    email = serializers.EmailField()
    username = serializers.CharField()
    password = serializers.CharField(write_only=True, trim_whitespace=False)
    terms_accepted = serializers.BooleanField(write_only=True)

    def validate_terms_accepted(self, value: bool) -> bool:
        if value is not True:
            raise serializers.ValidationError("Accept the terms before creating an account.")
        return value

    def validate_email(self, value: str) -> str:
        value = value.lower()
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError("An account with this email already exists.")
        return value

    def validate_username(self, value: str) -> str:
        value = value.lower()
        USERNAME_VALIDATOR(value)
        if username_taken(value):
            raise serializers.ValidationError("That username is taken.")
        return value

    def validate(self, attrs: dict) -> dict:
        probe = User(email=attrs["email"], username=attrs["username"])
        try:
            validate_password(attrs["password"], user=probe)
        except DjangoValidationError as exc:
            raise serializers.ValidationError({"password": exc.messages}) from exc
        return attrs

    def create(self, validated_data: dict) -> User:
        validated_data.pop("terms_accepted")
        return User.objects.create_user(**validated_data)


class LoginSerializer(serializers.Serializer[User]):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, trim_whitespace=False)

    def validate(self, attrs: dict) -> dict:
        user = authenticate(
            request=self.context.get("request"),
            username=attrs["email"].lower(),
            password=attrs["password"],
        )
        if user is None:
            raise serializers.ValidationError("Incorrect email or password.")
        attrs["user"] = user
        return attrs


class EmailSerializer(serializers.Serializer[None]):
    email = serializers.EmailField()


class TokenSerializer(serializers.Serializer[None]):
    token = serializers.CharField()


class PasswordResetConfirmSerializer(serializers.Serializer[None]):
    uid = serializers.CharField()
    token = serializers.CharField()
    password = serializers.CharField(write_only=True, trim_whitespace=False)


class ConfirmPasswordSerializer(serializers.Serializer[None]):
    current_password = serializers.CharField(
        write_only=True, trim_whitespace=False, required=False, default="", allow_blank=True
    )
    google_credential = serializers.CharField(write_only=True, required=False, max_length=8192)
    google_nonce = serializers.CharField(write_only=True, required=False, max_length=43)
    confirmation_purpose = GoogleChallenge.Purpose.DELETE

    def validate(self, attrs: dict) -> dict:
        request = self.context["request"]
        user = request.user
        if user.has_usable_password():
            if not user.check_password(attrs["current_password"]):
                raise serializers.ValidationError(
                    {"current_password": ["Current password is incorrect."]}
                )
        else:
            nonce = attrs.get("google_nonce", "")
            google.check_request(request, nonce)
            google.confirm(
                attrs.get("google_credential", ""), nonce, self.confirmation_purpose, user
            )
        return attrs


class ChangePasswordSerializer(ConfirmPasswordSerializer):
    new_password = serializers.CharField(write_only=True, trim_whitespace=False)
    confirmation_purpose = GoogleChallenge.Purpose.PASSWORD

    def validate_new_password(self, value: str) -> str:
        try:
            validate_password(value, user=self.context["request"].user)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.messages) from exc
        return value


class ProfileUpdateSerializer(serializers.ModelSerializer[Profile]):
    class Meta:
        model = Profile
        fields = ["display_name", "bio", "showcase_title", "binder_colour"]


class PreferencesSerializer(serializers.ModelSerializer[User]):
    class Meta:
        model = User
        fields = ["theme"]


def username_change_available_at(user: User) -> str | None:
    if user.username_changed_at is None:
        return None
    ready = user.username_changed_at + timedelta(days=USERNAME_COOLDOWN_DAYS)
    return None if ready <= timezone.now() else ready.isoformat()


def cooldown_error(user: User) -> None:
    """Raises if this account changed its username too recently.

    Shared so the check the serializer runs and the one the view repeats under
    the row lock tell the collector the same thing.
    """
    ready = username_change_available_at(user)
    if ready is not None:
        raise serializers.ValidationError(
            {
                "username": [
                    f"You can change your username again after "
                    f"{ready[:10]}. It is currently @{user.username}."
                ]
            }
        )


class UsernameChangeSerializer(ConfirmPasswordSerializer):
    username = serializers.CharField()
    confirmation_purpose = GoogleChallenge.Purpose.USERNAME

    def validate_username(self, value: str) -> str:
        user = self.context["request"].user
        value = value.strip().lower()
        USERNAME_VALIDATOR(value)
        if value == user.username:
            raise serializers.ValidationError("That is already your username.")
        # A name the asker holds in reserve is theirs to take back.
        if username_taken(value, by_other_than=user):
            raise serializers.ValidationError("That username is taken.")
        return value

    def validate(self, attrs: dict) -> dict:
        cooldown_error(self.context["request"].user)
        return super().validate(attrs)


class GoogleProofSerializer(serializers.Serializer[None]):
    credential = serializers.CharField(max_length=8192, trim_whitespace=False, write_only=True)
    nonce = serializers.CharField(
        min_length=43, max_length=43, trim_whitespace=False, write_only=True
    )


class GoogleRegisterSerializer(GoogleProofSerializer):
    username = serializers.CharField(max_length=20)
    terms_accepted = serializers.BooleanField()


class GoogleLinkSerializer(GoogleProofSerializer):
    current_password = serializers.CharField(write_only=True, trim_whitespace=False)


class GoogleChallengeSerializer(serializers.Serializer[None]):
    purpose = serializers.ChoiceField(choices=GoogleChallenge.Purpose.choices)

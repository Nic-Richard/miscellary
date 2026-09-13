from datetime import timedelta

from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.utils import timezone
from rest_framework import serializers

from .models import USERNAME_COOLDOWN_DAYS, USERNAME_VALIDATOR, Profile, User, username_taken


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

    class Meta:
        model = User
        fields = ["id", "email", "email_verified", "username_change_available_at", "profile"]
        read_only_fields = fields

    def get_username_change_available_at(self, obj: User) -> str | None:
        return username_change_available_at(obj)


class RegisterSerializer(serializers.Serializer[User]):
    email = serializers.EmailField()
    username = serializers.CharField()
    password = serializers.CharField(write_only=True, trim_whitespace=False)

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


class ChangePasswordSerializer(serializers.Serializer[None]):
    current_password = serializers.CharField(write_only=True, trim_whitespace=False)
    new_password = serializers.CharField(write_only=True, trim_whitespace=False)

    def validate_current_password(self, value: str) -> str:
        if not self.context["request"].user.check_password(value):
            raise serializers.ValidationError("Current password is incorrect.")
        return value

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


class UsernameChangeSerializer(serializers.Serializer[None]):
    username = serializers.CharField()
    current_password = serializers.CharField(write_only=True, trim_whitespace=False)

    def validate_current_password(self, value: str) -> str:
        if not self.context["request"].user.check_password(value):
            raise serializers.ValidationError("Current password is incorrect.")
        return value

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
        return attrs

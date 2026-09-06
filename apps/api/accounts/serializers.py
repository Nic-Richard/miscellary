from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from .models import USERNAME_VALIDATOR, Profile, User


class ProfileSerializer(serializers.ModelSerializer[Profile]):
    username = serializers.CharField(source="user.username", read_only=True)
    created_at = serializers.DateTimeField(source="user.created_at", read_only=True)
    avatar_url = serializers.CharField(read_only=True)

    class Meta:
        model = Profile
        fields = [
            "username",
            "display_name",
            "bio",
            "showcase_title",
            "binder_colour",
            "avatar_url",
            "created_at",
        ]


class CurrentUserSerializer(serializers.ModelSerializer[User]):
    profile = ProfileSerializer(read_only=True)

    class Meta:
        model = User
        fields = ["id", "email", "email_verified", "profile"]
        read_only_fields = fields


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
        if User.objects.filter(username=value).exists():
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

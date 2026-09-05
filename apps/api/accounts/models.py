import uuid

from django.contrib.auth.base_user import AbstractBaseUser, BaseUserManager
from django.contrib.auth.models import PermissionsMixin
from django.core.validators import RegexValidator
from django.db import models

USERNAME_VALIDATOR = RegexValidator(
    r"^[a-z0-9_]{3,20}$",
    "Usernames are 3-20 characters of lowercase letters, numbers, and underscores.",
)


class UserManager(BaseUserManager["User"]):
    def create_user(self, email: str, username: str, password: str, **extra) -> "User":
        if not email:
            raise ValueError("Email is required.")
        user = self.model(
            email=self.normalize_email(email).lower(), username=username.lower(), **extra
        )
        user.set_password(password)
        user.save(using=self._db)
        Profile.objects.create(user=user, display_name=username)
        return user

    def create_superuser(self, email: str, username: str, password: str, **extra) -> "User":
        extra.setdefault("is_staff", True)
        extra.setdefault("is_superuser", True)
        extra.setdefault("email_verified", True)
        return self.create_user(email, username, password, **extra)


class User(AbstractBaseUser, PermissionsMixin):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True)
    username = models.CharField(max_length=20, unique=True, validators=[USERNAME_VALIDATOR])
    email_verified = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    objects = UserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["username"]

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return self.username


class Profile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="profile")
    display_name = models.CharField(max_length=40, blank=True)
    bio = models.TextField(max_length=280, blank=True)
    showcase_title = models.CharField(max_length=60, blank=True)
    avatar_key = models.CharField(max_length=255, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:
        return f"Profile<{self.user.username}>"

    @property
    def avatar_url(self) -> str | None:
        return None

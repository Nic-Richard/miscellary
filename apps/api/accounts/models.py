import uuid

from django.contrib.auth.base_user import AbstractBaseUser, BaseUserManager
from django.contrib.auth.models import PermissionsMixin
from django.core.validators import RegexValidator
from django.db import models

from cards.identity import BINDER_COLOUR_CHOICES

USERNAME_VALIDATOR = RegexValidator(
    r"^[a-z0-9_]{3,20}$",
    "Usernames are 3-20 characters of lowercase letters, numbers, and underscores.",
)

USERNAME_COOLDOWN_DAYS = 30


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
    is_demo = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    username_changed_at = models.DateTimeField(null=True, blank=True)
    deleted_at = models.DateTimeField(null=True, blank=True)
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
    binder_colour = models.CharField(max_length=20, choices=BINDER_COLOUR_CHOICES, blank=True)
    avatar_key = models.CharField(max_length=255, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:
        return f"Profile<{self.user.username}>"

    @property
    def avatar_url(self) -> str | None:
        return None


class ReservedUsername(models.Model):
    """The name a collector last went by.

    A changed username is not returned to the pool straight away: profile links
    carry usernames, so releasing one immediately would let somebody else stand
    where an old link points. The reservation is released by the owner's next
    change, which replaces it, so each account holds exactly one former name.
    """

    username = models.CharField(max_length=20, unique=True)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="reserved_usernames")
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return f"{self.username} (was {self.user})"


def username_taken(username: str, by_other_than: User | None = None) -> bool:
    # Closed accounts are renamed deleted_<id>; nobody else may look like one.
    if username.startswith("deleted"):
        return True
    users = User.objects.filter(username=username)
    reserved = ReservedUsername.objects.filter(username=username)
    if by_other_than is not None:
        users = users.exclude(pk=by_other_than.pk)
        reserved = reserved.exclude(user=by_other_than)
    return users.exists() or reserved.exists()

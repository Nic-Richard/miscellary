import pytest
from django.core.management import call_command
from django.core.management.base import CommandError

from accounts.models import User

pytestmark = pytest.mark.django_db


def test_bootstrap_admin_creates_once(monkeypatch):
    monkeypatch.setenv("INITIAL_ADMIN_EMAIL", "Admin@Example.com")
    monkeypatch.setenv("INITIAL_ADMIN_USERNAME", "owner")
    monkeypatch.setenv("INITIAL_ADMIN_PASSWORD", "a-long-admin-passphrase")

    call_command("bootstrap_admin")
    call_command("bootstrap_admin")

    admin = User.objects.get(email="admin@example.com")
    assert admin.username == "owner"
    assert admin.is_staff and admin.is_superuser and admin.email_verified
    assert admin.check_password("a-long-admin-passphrase")


def test_bootstrap_admin_does_not_promote_an_existing_user(monkeypatch, user):
    monkeypatch.setenv("INITIAL_ADMIN_EMAIL", user.email)
    monkeypatch.setenv("INITIAL_ADMIN_USERNAME", user.username)
    monkeypatch.setenv("INITIAL_ADMIN_PASSWORD", "a-long-admin-passphrase")

    with pytest.raises(CommandError, match="already in use"):
        call_command("bootstrap_admin")

    user.refresh_from_db()
    assert not user.is_staff and not user.is_superuser

import pytest
from django.core.management import call_command
from django.core.management.base import CommandError

from accounts.models import User
from conftest import make_user

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


@pytest.mark.django_db
def test_admin_closes_banned_accounts_after_confirmation(client):
    from django.contrib.admin import helpers

    admin_user = make_user(is_staff=True, is_superuser=True)
    banned = make_user(is_active=False)
    staff = make_user(is_staff=True)
    client.force_login(admin_user)
    url = "/admin/accounts/user/"
    data = {"action": "close_accounts", helpers.ACTION_CHECKBOX_NAME: [banned.pk, staff.pk]}
    page = client.post(url, data)
    assert page.status_code == 200
    assert f"@{banned.username}" in page.content.decode()
    assert f"@{staff.username}" not in page.content.decode()
    banned.refresh_from_db()
    assert banned.deleted_at is None
    client.post(url, {**data, "confirm": "yes"})
    banned.refresh_from_db()
    staff.refresh_from_db()
    assert banned.deleted_at is not None
    assert staff.deleted_at is None

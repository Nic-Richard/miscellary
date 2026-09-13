from datetime import timedelta

import pytest
from django.urls import reverse
from django.utils import timezone

from accounts.models import ReservedUsername, User
from conftest import PASSWORD, make_user

pytestmark = pytest.mark.django_db

URL = "/api/v1/auth/username/"


def change(client, username, password=PASSWORD):
    return client.post(URL, {"username": username, "current_password": password}, format="json")


def test_changing_a_username_reserves_the_old_one(auth_client, user):
    was = user.username
    body = change(auth_client, "beetleman").json()
    assert body["profile"]["username"] == "beetleman"
    user.refresh_from_db()
    assert user.username == "beetleman" and user.username_changed_at is not None
    assert list(ReservedUsername.objects.values_list("username", flat=True)) == [was]


def test_a_reserved_name_cannot_be_taken_by_anyone_else(api_client, auth_client, user):
    was = user.username
    change(auth_client, "beetleman")

    response = api_client.post(
        "/api/v1/auth/register/",
        {"email": "new@example.com", "username": was, "password": PASSWORD},
        format="json",
    )
    assert response.status_code == 400
    assert "taken" in response.json()["error"]
    assert not User.objects.filter(email="new@example.com").exists()


def test_you_can_take_your_own_reserved_name_back(auth_client, user):
    was = user.username
    change(auth_client, "beetleman")
    user.refresh_from_db()
    user.username_changed_at = timezone.now() - timedelta(days=31)
    user.save(update_fields=["username_changed_at"])

    assert change(auth_client, was).status_code == 200
    user.refresh_from_db()
    assert user.username == was
    assert list(ReservedUsername.objects.values_list("username", flat=True)) == ["beetleman"]


def test_a_second_change_releases_the_older_reservation(auth_client, user):
    was = user.username
    change(auth_client, "beetleman")
    user.refresh_from_db()
    user.username_changed_at = timezone.now() - timedelta(days=31)
    user.save(update_fields=["username_changed_at"])
    change(auth_client, "rockhound")

    assert list(ReservedUsername.objects.values_list("username", flat=True)) == ["beetleman"]
    assert not ReservedUsername.objects.filter(username=was).exists()


def test_the_cooldown_blocks_a_second_change(auth_client, user):
    change(auth_client, "beetleman")
    response = change(auth_client, "rockhound")
    assert response.status_code == 400
    assert "again after" in response.json()["error"]
    user.refresh_from_db()
    assert user.username == "beetleman"


def test_a_taken_or_invalid_name_is_refused(auth_client, user):
    make_user(username="taken")
    assert change(auth_client, "taken").status_code == 400
    assert change(auth_client, "No Spaces").status_code == 400
    assert change(auth_client, user.username).status_code == 400
    assert change(auth_client, "beetleman", password="wrong").status_code == 400
    user.refresh_from_db()
    assert user.username_changed_at is None


def test_the_cooldown_is_reported_to_the_account_page(auth_client, user):
    assert auth_client.get(reverse("accounts:me")).json()["username_change_available_at"] is None
    change(auth_client, "beetleman")
    assert auth_client.get(reverse("accounts:me")).json()["username_change_available_at"]


def test_the_cooldown_is_rechecked_against_the_stored_row(auth_client, user):
    """Validation runs before the row is locked, so the write checks again.

    Two requests can both clear the serializer before either writes; only the
    one that holds the row should be allowed through.
    """
    assert change(auth_client, "firstname").status_code == 200
    user.refresh_from_db()
    assert user.username_changed_at is not None
    response = change(auth_client, "secondname")
    assert response.status_code == 400
    user.refresh_from_db()
    assert user.username == "firstname"


def test_a_name_taken_between_validation_and_the_write_is_a_clean_error(auth_client, user):
    User.objects.filter(pk=user.pk).update(username_changed_at=None)
    other = make_user(username="holder")
    ReservedUsername.objects.filter(user=other).delete()
    response = change(auth_client, "holder")
    assert response.status_code == 400
    assert "taken" in str(response.json()).lower()

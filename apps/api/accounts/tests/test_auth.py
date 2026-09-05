import re

import pytest
from django.conf import settings
from django.core import mail
from django.urls import reverse

from accounts.models import User
from conftest import PASSWORD, make_user

pytestmark = pytest.mark.django_db

REGISTER = {"email": "Nic@Example.com", "username": "Nic_01", "password": "a-long-passphrase-9"}


def test_register_creates_user_profile_and_session(api_client):
    response = api_client.post(reverse("accounts:register"), REGISTER, format="json")

    assert response.status_code == 201
    body = response.json()
    assert body["user"]["email"] == "nic@example.com"
    assert body["user"]["profile"]["username"] == "nic_01"
    assert body["user"]["email_verified"] is False
    assert "access" in body and "refresh" not in body
    assert settings.REFRESH_COOKIE_NAME in response.cookies
    assert response.cookies[settings.REFRESH_COOKIE_NAME]["httponly"]
    assert User.objects.get(email="nic@example.com").profile.display_name == "nic_01"
    assert len(mail.outbox) == 1 and "verify-email?token=" in mail.outbox[0].body


def test_register_rejects_duplicates_and_bad_usernames(api_client):
    make_user(email="taken@example.com", username="taken")
    response = api_client.post(
        reverse("accounts:register"),
        {"email": "TAKEN@example.com", "username": "Bad Name!", "password": "a-long-passphrase-9"},
        format="json",
    )

    assert response.status_code == 400
    body = response.json()
    assert "email" in body["fields"] and "username" in body["fields"]
    assert body["error"]


def test_register_rejects_weak_password(api_client):
    response = api_client.post(
        reverse("accounts:register"), {**REGISTER, "password": "password"}, format="json"
    )
    assert response.status_code == 400
    assert "password" in response.json()["fields"]


def test_login_web_sets_cookie_and_returns_access(api_client, user):
    response = api_client.post(
        reverse("accounts:login"),
        {"email": user.email, "password": PASSWORD},
        format="json",
    )

    assert response.status_code == 200
    assert "access" in response.json() and "refresh" not in response.json()
    assert settings.REFRESH_COOKIE_NAME in response.cookies


def test_login_mobile_returns_refresh_in_body(api_client, user):
    response = api_client.post(
        reverse("accounts:login"),
        {"email": user.email, "password": PASSWORD},
        format="json",
        headers={"X-Client-Platform": "mobile"},
    )

    assert response.status_code == 200
    assert "refresh" in response.json()
    assert settings.REFRESH_COOKIE_NAME not in response.cookies


def test_login_wrong_password(api_client, user):
    response = api_client.post(
        reverse("accounts:login"), {"email": user.email, "password": "nope"}, format="json"
    )
    assert response.status_code == 400
    assert response.json()["error"] == "Incorrect email or password."


def test_me_requires_auth(api_client):
    assert api_client.get(reverse("accounts:me")).status_code == 401


def test_access_token_authenticates(api_client, user):
    login = api_client.post(
        reverse("accounts:login"),
        {"email": user.email, "password": PASSWORD},
        format="json",
    )
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {login.json()['access']}")

    me = api_client.get(reverse("accounts:me"))
    assert me.status_code == 200
    assert me.json()["profile"]["username"] == user.username


def test_refresh_rotates_and_blacklists_old_token(api_client, user):
    login = api_client.post(
        reverse("accounts:login"),
        {"email": user.email, "password": PASSWORD},
        format="json",
        headers={"X-Client-Platform": "mobile"},
    )
    old_refresh = login.json()["refresh"]

    first = api_client.post(
        reverse("accounts:refresh"),
        {"refresh": old_refresh},
        format="json",
        headers={"X-Client-Platform": "mobile"},
    )
    assert first.status_code == 200
    assert first.json()["refresh"] != old_refresh

    replay = api_client.post(
        reverse("accounts:refresh"),
        {"refresh": old_refresh},
        format="json",
        headers={"X-Client-Platform": "mobile"},
    )
    assert replay.status_code == 401


def test_refresh_via_cookie(api_client, user):
    api_client.post(
        reverse("accounts:login"),
        {"email": user.email, "password": PASSWORD},
        format="json",
    )
    response = api_client.post(reverse("accounts:refresh"))
    assert response.status_code == 200
    assert "access" in response.json()
    assert settings.REFRESH_COOKIE_NAME in response.cookies


def test_refresh_without_token(api_client):
    assert api_client.post(reverse("accounts:refresh")).status_code == 401


def test_logout_blacklists_and_clears_cookie(api_client, user):
    api_client.post(
        reverse("accounts:login"),
        {"email": user.email, "password": PASSWORD},
        format="json",
    )
    response = api_client.post(reverse("accounts:logout"))
    assert response.status_code == 204
    assert response.cookies[settings.REFRESH_COOKIE_NAME].value == ""

    api_client.cookies.clear()
    assert api_client.post(reverse("accounts:refresh")).status_code == 401


def test_update_profile(auth_client, user):
    response = auth_client.patch(
        reverse("accounts:me"), {"display_name": "Nic", "bio": "Rocks and vinyl."}, format="json"
    )
    assert response.status_code == 200
    assert response.json()["profile"]["display_name"] == "Nic"
    user.profile.refresh_from_db()
    assert user.profile.bio == "Rocks and vinyl."


def test_change_password(auth_client, user):
    response = auth_client.post(
        reverse("accounts:password-change"),
        {"current_password": PASSWORD, "new_password": "another-long-one-42"},
        format="json",
    )
    assert response.status_code == 204
    user.refresh_from_db()
    assert user.check_password("another-long-one-42")


def test_change_password_wrong_current(auth_client):
    response = auth_client.post(
        reverse("accounts:password-change"),
        {"current_password": "wrong", "new_password": "another-long-one-42"},
        format="json",
    )
    assert response.status_code == 400
    assert "current_password" in response.json()["fields"]


def _link_param(body: str, name: str) -> str:
    match = re.search(rf"[?&]{name}=([^&\s]+)", body)
    assert match, f"{name} missing from email"
    return match.group(1)


def test_email_verification_flow(api_client, auth_client, user):
    assert auth_client.post(reverse("accounts:verify-request")).status_code == 204
    token = _link_param(str(mail.outbox[-1].body), "token")

    response = api_client.post(reverse("accounts:verify-confirm"), {"token": token}, format="json")
    assert response.status_code == 204
    user.refresh_from_db()
    assert user.email_verified is True


def test_email_verification_bad_token(api_client):
    response = api_client.post(reverse("accounts:verify-confirm"), {"token": "junk"}, format="json")
    assert response.status_code == 400
    assert "token" in response.json()["fields"]


def test_password_reset_flow(api_client, user):
    response = api_client.post(
        reverse("accounts:reset-request"), {"email": user.email.upper()}, format="json"
    )
    assert response.status_code == 204
    body = str(mail.outbox[-1].body)
    uid, token = _link_param(body, "uid"), _link_param(body, "token")

    confirm = api_client.post(
        reverse("accounts:reset-confirm"),
        {"uid": uid, "token": token, "password": "fresh-passphrase-77"},
        format="json",
    )
    assert confirm.status_code == 204
    user.refresh_from_db()
    assert user.check_password("fresh-passphrase-77")

    # Tokens are single use: the password hash changed, so the stamp no longer matches.
    reused = api_client.post(
        reverse("accounts:reset-confirm"),
        {"uid": uid, "token": token, "password": "yet-another-one-88"},
        format="json",
    )
    assert reused.status_code == 400


def test_password_reset_unknown_email_is_silent(api_client):
    response = api_client.post(
        reverse("accounts:reset-request"), {"email": "ghost@example.com"}, format="json"
    )
    assert response.status_code == 204
    assert mail.outbox == []


def test_inactive_user_cannot_login(api_client):
    user = make_user(is_active=False)
    response = api_client.post(
        reverse("accounts:login"),
        {"email": user.email, "password": PASSWORD},
        format="json",
    )
    assert response.status_code == 400

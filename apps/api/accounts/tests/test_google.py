from datetime import timedelta
from types import SimpleNamespace

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from django.urls import reverse
from django.utils import timezone
from rest_framework.exceptions import AuthenticationFailed, ValidationError

from accounts import google
from accounts.lifecycle import delete_account
from accounts.models import GoogleChallenge, GoogleIdentity
from conftest import PASSWORD, make_user

pytestmark = pytest.mark.django_db


@pytest.fixture
def credentials(settings, monkeypatch):
    settings.GOOGLE_CLIENT_IDS = ["miscellary-web-client"]
    private = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    monkeypatch.setattr(
        google._keys,
        "get_signing_key_from_jwt",
        lambda _: SimpleNamespace(key=private.public_key()),
    )

    def sign(challenge_nonce, **overrides):
        now = int(timezone.now().timestamp())
        return jwt.encode(
            {
                "sub": "google-collector",
                "email": "collector@gmail.com",
                "email_verified": True,
                "iss": "https://accounts.google.com",
                "aud": "miscellary-web-client",
                "iat": now,
                "exp": now + 3600,
                "nonce": challenge_nonce,
                **overrides,
            },
            private,
            algorithm="RS256",
            headers={"kid": "test-key"},
        )

    return sign


@pytest.mark.parametrize(
    "overrides",
    [
        {"aud": "another-app"},
        {"iss": "https://another-provider.invalid"},
        {"exp": 1},
        {"exp": None},
        {"iat": 9999999999},
        {"nonce": "another-confirmation"},
        {"nonce": "\u00e9"},
        {"email_verified": False},
        {"email_verified": "true"},
        {"email": "not-an-email"},
        {"sub": ""},
    ],
)
def test_rejects_invalid_google_claims(credentials, overrides):
    nonce = google.issue_challenge("login")
    with pytest.raises(AuthenticationFailed):
        google.verify_credential(credentials(nonce, **overrides), nonce)


def test_rejects_wrong_signature_and_algorithm(credentials):
    nonce = google.issue_challenge("login")
    token = credentials(nonce)
    other_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    claims = jwt.decode(token, options={"verify_signature": False})
    invalid = [jwt.encode(claims, other_key, algorithm="RS256")]
    invalid.append(jwt.encode(claims, "not-a-google-key" * 3, algorithm="HS256"))
    for credential in invalid:
        with pytest.raises(AuthenticationFailed):
            google.verify_credential(credential, nonce)


def test_email_authority_does_not_follow_verification_alone(credentials):
    nonce = google.issue_challenge("login")
    assert google.verify_credential(credentials(nonce), nonce).email_authoritative
    external = credentials(nonce, email="collector@example.com")
    assert not google.verify_credential(external, nonce).email_authoritative
    workspace = credentials(nonce, email="collector@example.com", hd="example.com")
    assert google.verify_credential(workspace, nonce).email_authoritative


def test_login_uses_linked_subject_not_email_and_cannot_replay(credentials, user):
    GoogleIdentity.objects.create(user=user, subject="google-collector")
    nonce = google.issue_challenge("login")
    token = credentials(nonce, email="changed@gmail.com")
    assert google.login(token, nonce).pk == user.pk
    with pytest.raises(AuthenticationFailed):
        google.login(token, nonce)
    nonce = google.issue_challenge("login")
    with pytest.raises(ValidationError):
        google.login(credentials(nonce, sub="unlinked", email=user.email), nonce)
    user.is_active = False
    user.save(update_fields=["is_active"])
    with pytest.raises(AuthenticationFailed):
        google.login(credentials(nonce), nonce)


def test_link_requires_current_password_and_keeps_existing_account(credentials, user):
    nonce = google.issue_challenge("link", user)
    token = credentials(nonce)
    with pytest.raises(AuthenticationFailed):
        google.link(token, nonce, user, "wrong-password")
    google.link(token, nonce, user, PASSWORD)
    assert GoogleIdentity.objects.get(subject="google-collector").user_id == user.pk
    user.refresh_from_db()
    assert user.check_password(PASSWORD)
    assert user.email != "collector@gmail.com"
    with pytest.raises(AuthenticationFailed):
        google.link(token, nonce, user, PASSWORD)


def test_link_rejects_identity_already_owned_by_another_account(credentials, user):
    GoogleIdentity.objects.create(user=make_user(), subject="google-collector")
    nonce = google.issue_challenge("link", user)
    with pytest.raises(ValidationError):
        google.link(credentials(nonce), nonce, user, PASSWORD)
    assert not GoogleIdentity.objects.filter(user=user).exists()


def test_non_google_mailboxes_require_existing_email_verification(credentials, user):
    nonce = google.issue_challenge("login")
    with pytest.raises(ValidationError):
        google.register(
            credentials(nonce, email="external@example.com"), nonce, "new_collector", True
        )
    assert not GoogleIdentity.objects.exists()
    nonce = google.issue_challenge("link", user)
    user.email_verified = False
    user.save(update_fields=["email_verified"])
    with pytest.raises(ValidationError):
        google.link(credentials(nonce), nonce, user, PASSWORD)
    user.email_verified = True
    user.save(update_fields=["email_verified"])
    google.link(credentials(nonce, email="external@example.com"), nonce, user, PASSWORD)
    assert GoogleIdentity.objects.filter(user=user).exists()


def test_disconnect_requires_another_login_method_and_current_password(credentials, user):
    GoogleIdentity.objects.create(user=user, subject="google-collector")
    with pytest.raises(AuthenticationFailed):
        google.disconnect(user, "incorrect")
    user.set_unusable_password()
    user.save(update_fields=["password"])
    with pytest.raises(ValidationError):
        google.disconnect(user, "")
    assert GoogleIdentity.objects.filter(user=user).exists()
    user.set_password(PASSWORD)
    user.save(update_fields=["password"])
    google.issue_challenge("delete", user)
    google.disconnect(user, PASSWORD)
    assert not GoogleIdentity.objects.filter(user=user).exists()
    assert not GoogleChallenge.objects.filter(user=user).exists()
    user.refresh_from_db()
    assert user.check_password(PASSWORD)


def test_confirm_is_bound_to_account_action_and_expiry(credentials, user):
    GoogleIdentity.objects.create(user=user, subject="google-collector")
    nonce = google.issue_challenge("delete", user)
    token = credentials(nonce)
    with pytest.raises(AuthenticationFailed):
        google.confirm(token, nonce, "username", user)
    with pytest.raises(AuthenticationFailed):
        google.confirm(token, nonce, "delete", make_user())
    with pytest.raises(AuthenticationFailed):
        google.confirm(credentials(nonce, sub="another-google-account"), nonce, "delete", user)
    google.confirm(token, nonce, "delete", user)
    with pytest.raises(AuthenticationFailed):
        google.confirm(token, nonce, "delete", user)
    nonce = google.issue_challenge("password", user)
    GoogleChallenge.objects.update(expires_at=timezone.now() - timedelta(seconds=1))
    with pytest.raises(AuthenticationFailed):
        google.confirm(credentials(nonce), nonce, "password", user)


def test_closed_account_cannot_confirm_and_closure_removes_google_data(credentials, user):
    GoogleIdentity.objects.create(user=user, subject="google-collector")
    nonce = google.issue_challenge("delete", user)
    user.is_active = False
    user.save(update_fields=["is_active"])
    with pytest.raises(AuthenticationFailed):
        google.confirm(credentials(nonce), nonce, "delete", user)
    delete_account(user)
    assert not GoogleIdentity.objects.filter(user=user).exists()
    assert not GoogleChallenge.objects.filter(user=user).exists()


def test_challenges_require_configuration_and_clean_up_expired_rows(credentials, settings, user):
    google.issue_challenge("login")
    GoogleChallenge.objects.update(expires_at=timezone.now() - timedelta(seconds=1))
    google.issue_challenge("login")
    assert GoogleChallenge.objects.count() == 1
    assert len(GoogleChallenge.objects.get().digest) == 64
    with pytest.raises(AuthenticationFailed):
        google.issue_challenge("link")
    with pytest.raises(ValidationError):
        google.issue_challenge("login", user)
    settings.GOOGLE_CLIENT_IDS = []
    with pytest.raises(ValidationError):
        google.issue_challenge("login")
    with pytest.raises(ValidationError):
        google.verify_credential("unused", "unused")


@pytest.mark.parametrize("platform", ["web", "mobile"])
def test_google_http_sessions_and_browser_binding(
    credentials, api_client, user, settings, platform
):
    settings.CORS_ALLOWED_ORIGINS = ["https://miscellary.com"]
    GoogleIdentity.objects.create(user=user, subject="google-collector")
    headers = {"HTTP_X_CLIENT_PLATFORM": platform, "HTTP_ORIGIN": "https://miscellary.com"}
    response = api_client.post(
        reverse("accounts:google-challenge"), {"purpose": "login"}, format="json", **headers
    )
    assert response.status_code == 200
    nonce = response.json()["nonce"]
    proof = {"credential": credentials(nonce), "nonce": nonce}
    if platform == "web":
        assert response.cookies[google.CHALLENGE_COOKIE]["httponly"]
        bad_origin = {**headers, "HTTP_ORIGIN": "https://another-site.invalid"}
        assert (
            api_client.post(
                reverse("accounts:google-login"), proof, format="json", **bad_origin
            ).status_code
            == 401
        )
        api_client.cookies[google.CHALLENGE_COOKIE] = "another-browser"
        assert (
            api_client.post(
                reverse("accounts:google-login"), proof, format="json", **headers
            ).status_code
            == 401
        )
        api_client.cookies[google.CHALLENGE_COOKIE] = nonce
    response = api_client.post(reverse("accounts:google-login"), proof, format="json", **headers)
    assert response.status_code == 200
    assert response.json()["user"]["id"] == str(user.pk)
    assert response.json()["user"]["google_connected"]
    assert ("refresh" in response.json()) == (platform == "mobile")
    assert (settings.REFRESH_COOKIE_NAME in response.cookies) == (platform == "web")
    assert (
        api_client.post(
            reverse("accounts:google-login"), proof, format="json", **headers
        ).status_code
        == 401
    )


def test_google_signup_keeps_verified_identity_and_requires_terms(credentials, api_client):
    headers = {"HTTP_X_CLIENT_PLATFORM": "mobile"}
    nonce = google.issue_challenge("login")
    proof = {"credential": credentials(nonce), "nonce": nonce}
    response = api_client.post(reverse("accounts:google-login"), proof, format="json", **headers)
    assert response.status_code == 409
    assert response.json()["code"] == "google_signup_required"
    payload = {**proof, "username": "new_collector", "terms_accepted": False}
    assert (
        api_client.post(
            reverse("accounts:google-register"), payload, format="json", **headers
        ).status_code
        == 400
    )
    payload["terms_accepted"] = True
    response = api_client.post(
        reverse("accounts:google-register"), payload, format="json", **headers
    )
    assert response.status_code == 201
    account = response.json()["user"]
    assert account["profile"]["username"] == "new_collector"
    assert account["email_verified"] and account["google_connected"]
    assert not account["has_password"]
    assert (
        GoogleIdentity.objects.get(subject="google-collector").user.has_usable_password() is False
    )


def test_google_signup_never_merges_an_existing_email(credentials, api_client, user):
    nonce = google.issue_challenge("login")
    payload = {
        "credential": credentials(nonce, email=user.email),
        "nonce": nonce,
        "username": "another_collector",
        "terms_accepted": True,
    }
    response = api_client.post(
        reverse("accounts:google-register"), payload, format="json", HTTP_X_CLIENT_PLATFORM="mobile"
    )
    assert response.status_code == 400
    assert not GoogleIdentity.objects.exists()
    user.refresh_from_db()
    assert user.check_password(PASSWORD)


def test_google_only_settings_require_fresh_confirmation(credentials, api_client):
    user = make_user(password=None)
    GoogleIdentity.objects.create(user=user, subject="google-collector")
    api_client.force_authenticate(user=user)
    headers = {"HTTP_X_CLIENT_PLATFORM": "mobile"}

    def proof(purpose):
        nonce = google.issue_challenge(purpose, user)
        return {"google_credential": credentials(nonce), "google_nonce": nonce}

    response = api_client.post(
        reverse("accounts:username-change"),
        {"username": "renamed_collector", **proof("username")},
        format="json",
        **headers,
    )
    assert response.status_code == 200
    assert response.json()["profile"]["username"] == "renamed_collector"
    response = api_client.post(
        reverse("accounts:password-change"),
        {"new_password": "another-long-password-42", **proof("password")},
        format="json",
        **headers,
    )
    assert response.status_code == 200
    user.refresh_from_db()
    assert user.check_password("another-long-password-42")
    response = api_client.post(
        reverse("accounts:delete"), proof("delete"), format="json", **headers
    )
    assert response.status_code == 400
    assert "current_password" in response.json()["fields"]


def test_google_only_closure_and_private_challenge_require_auth(credentials, api_client):
    headers = {"HTTP_X_CLIENT_PLATFORM": "mobile"}
    assert (
        api_client.post(
            reverse("accounts:google-challenge"), {"purpose": "link"}, format="json", **headers
        ).status_code
        == 401
    )
    user = make_user(password=None)
    GoogleIdentity.objects.create(user=user, subject="google-collector")
    api_client.force_authenticate(user=user)
    nonce = google.issue_challenge("delete", user)
    response = api_client.post(
        reverse("accounts:delete"),
        {"google_credential": credentials(nonce), "google_nonce": nonce},
        format="json",
        **headers,
    )
    assert response.status_code == 204
    user.refresh_from_db()
    assert not user.is_active
    assert not GoogleIdentity.objects.filter(user=user).exists()

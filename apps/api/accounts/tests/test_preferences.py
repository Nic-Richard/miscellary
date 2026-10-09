import pytest

from accounts.serializers import ProfileSerializer
from accounts.themes import DEFAULT_THEME, THEME_CHOICES
from conftest import make_user

pytestmark = pytest.mark.django_db
URL = "/api/v1/auth/preferences/"


def test_preferences_require_login(api_client):
    assert api_client.patch(URL, {"theme": DEFAULT_THEME}).status_code == 401


def test_theme_is_private_and_saved_to_current_account(auth_client, user):
    other = make_user()
    for theme, _ in THEME_CHOICES:
        response = auth_client.patch(
            URL, {"theme": theme, "id": str(other.pk), "username": "changed"}, format="json"
        )
        assert response.status_code == 200
        user.refresh_from_db()
        assert response.data["theme"] == user.theme == theme
        assert auth_client.get("/api/v1/auth/me/").data["theme"] == theme
    other.refresh_from_db()
    assert user.username != "changed"
    assert other.theme == DEFAULT_THEME
    assert "theme" not in ProfileSerializer(user.profile).data


def test_unknown_theme_does_not_change_preference(auth_client, user):
    response = auth_client.patch(URL, {"theme": "unavailable"}, format="json")
    assert response.status_code == 400
    assert "theme" in response.data["fields"]
    user.refresh_from_db()
    assert user.theme == DEFAULT_THEME

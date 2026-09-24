import itertools

import pytest
from rest_framework.test import APIClient

from accounts.models import User

PASSWORD = "correct-horse-battery"
_counter = itertools.count()


def make_user(**overrides) -> User:
    n = next(_counter)
    return User.objects.create_user(
        email=overrides.pop("email", f"user{n}@example.com"),
        username=overrides.pop("username", f"user{n}"),
        password=overrides.pop("password", PASSWORD),
        **{"email_verified": True, **overrides},
    )


@pytest.fixture
def api_client() -> APIClient:
    return APIClient()


@pytest.fixture
def user(db) -> User:
    return make_user()


@pytest.fixture
def auth_client(api_client: APIClient, user: User) -> APIClient:
    api_client.force_authenticate(user=user)
    return api_client

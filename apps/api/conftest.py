import itertools

import pytest
from rest_framework.test import APIClient

from accounts.models import User

PASSWORD = "correct-horse-battery"
_counter = itertools.count()


def make_user(**overrides) -> User:
    n = next(_counter)
    fields = {"email": f"user{n}@example.com", "username": f"user{n}", "password": PASSWORD}
    fields.update(overrides)
    return User.objects.create_user(**fields)


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

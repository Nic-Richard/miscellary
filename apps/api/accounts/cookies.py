"""Refresh-token transport.

Web clients send `X-Client-Platform: web` and get the refresh token in an
HttpOnly cookie scoped to the auth endpoints. Mobile clients get it in the
response body and store it in secure device storage.
"""

from django.conf import settings
from rest_framework.request import Request
from rest_framework.response import Response

WEB = "web"
MOBILE = "mobile"


def client_platform(request: Request) -> str:
    platform = request.headers.get("X-Client-Platform", WEB).lower()
    return MOBILE if platform == MOBILE else WEB


def set_refresh_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        settings.REFRESH_COOKIE_NAME,
        token,
        max_age=settings.REFRESH_COOKIE_MAX_AGE,
        path=settings.REFRESH_COOKIE_PATH,
        secure=settings.REFRESH_COOKIE_SECURE,
        httponly=True,
        samesite=settings.REFRESH_COOKIE_SAMESITE,  # type: ignore[arg-type]
    )


def clear_refresh_cookie(response: Response) -> None:
    response.delete_cookie(
        settings.REFRESH_COOKIE_NAME,
        path=settings.REFRESH_COOKIE_PATH,
        samesite=settings.REFRESH_COOKIE_SAMESITE,  # type: ignore[arg-type]
    )


def incoming_refresh_token(request: Request) -> str | None:
    if client_platform(request) == MOBILE:
        return request.data.get("refresh") or None  # type: ignore[union-attr]
    return request.COOKIES.get(settings.REFRESH_COOKIE_NAME)


def attach_tokens(request: Request, response: Response, access: str, refresh: str) -> Response:
    response.data = {**(response.data or {}), "access": access}
    if client_platform(request) == MOBILE:
        response.data["refresh"] = refresh
    else:
        set_refresh_cookie(response, refresh)
    return response

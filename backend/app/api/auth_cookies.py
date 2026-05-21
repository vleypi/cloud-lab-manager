from fastapi import Response

from app.config import get_settings
from app.core.security import (
    generate_csrf_token,
    issue_access_token,
    issue_refresh_token,
)

_REFRESH_PATH = "/api/v1/auth"


def issue_session(response: Response, *, user_id: str, is_super_admin: bool) -> str:
    settings = get_settings()
    refresh = issue_refresh_token(user_id=user_id)
    csrf = generate_csrf_token()

    _set_access_cookie(response, user_id=user_id, is_super_admin=is_super_admin)
    _set_cookie(
        response,
        name=settings.cookie_refresh_name,
        value=refresh,
        max_age=settings.jwt_refresh_ttl_seconds,
        http_only=True,
        path=_REFRESH_PATH,
    )
    _set_cookie(
        response,
        name=settings.cookie_csrf_name,
        value=csrf,
        max_age=settings.csrf_ttl_seconds,
        http_only=False,
        path="/",
    )
    return csrf


def rotate_access(response: Response, *, user_id: str, is_super_admin: bool) -> None:
    _set_access_cookie(response, user_id=user_id, is_super_admin=is_super_admin)


def _set_access_cookie(
    response: Response, *, user_id: str, is_super_admin: bool
) -> None:
    settings = get_settings()
    access = issue_access_token(user_id=user_id, is_super_admin=is_super_admin)
    _set_cookie(
        response,
        name=settings.cookie_access_name,
        value=access,
        max_age=settings.jwt_access_ttl_seconds,
        http_only=True,
        path="/",
    )


def clear_session(response: Response) -> None:
    settings = get_settings()
    _clear_cookie(response, name=settings.cookie_access_name, path="/")
    _clear_cookie(response, name=settings.cookie_refresh_name, path=_REFRESH_PATH)
    _clear_cookie(response, name=settings.cookie_csrf_name, path="/")


def _set_cookie(
    response: Response,
    *,
    name: str,
    value: str,
    max_age: int,
    http_only: bool,
    path: str,
) -> None:
    settings = get_settings()
    response.set_cookie(
        key=name,
        value=value,
        max_age=max_age,
        httponly=http_only,
        secure=settings.cookie_secure,
        samesite=settings.cookie_samesite,
        path=path,
        domain=settings.cookie_domain or None,
    )


def _clear_cookie(response: Response, *, name: str, path: str) -> None:
    settings = get_settings()
    response.delete_cookie(
        key=name,
        path=path,
        domain=settings.cookie_domain or None,
    )

import secrets
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError

from app.config import get_settings

_JWT_ALGORITHM = "HS256"

_password_hasher = PasswordHasher()


class TokenError(Exception):
    pass


@dataclass(frozen=True, slots=True)
class TokenPayload:
    subject: str
    is_super_admin: bool
    jti: str
    issued_at: datetime
    expires_at: datetime


def issue_access_token(*, user_id: str, is_super_admin: bool) -> str:
    settings = get_settings()
    return _issue(
        secret=settings.jwt_access_secret.get_secret_value(),
        ttl_seconds=settings.jwt_access_ttl_seconds,
        sub=user_id,
        extra={"is_super_admin": is_super_admin, "typ": "access"},
    )


def issue_refresh_token(*, user_id: str) -> str:
    settings = get_settings()
    return _issue(
        secret=settings.jwt_refresh_secret.get_secret_value(),
        ttl_seconds=settings.jwt_refresh_ttl_seconds,
        sub=user_id,
        extra={"typ": "refresh"},
    )


def verify_access_token(token: str) -> TokenPayload:
    settings = get_settings()
    return _verify(
        token,
        secret=settings.jwt_access_secret.get_secret_value(),
        expected_typ="access",
    )


def verify_refresh_token(token: str) -> TokenPayload:
    settings = get_settings()
    return _verify(
        token,
        secret=settings.jwt_refresh_secret.get_secret_value(),
        expected_typ="refresh",
    )


def _issue(*, secret: str, ttl_seconds: int, sub: str, extra: dict) -> str:
    now = datetime.now(timezone.utc)
    payload: dict[str, object] = {
        "sub": sub,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(seconds=ttl_seconds)).timestamp()),
        "jti": secrets.token_urlsafe(16),
        **extra,
    }
    return jwt.encode(payload, secret, algorithm=_JWT_ALGORITHM)


def _verify(token: str, *, secret: str, expected_typ: str) -> TokenPayload:
    try:
        payload = jwt.decode(token, secret, algorithms=[_JWT_ALGORITHM])
    except jwt.PyJWTError as exc:
        raise TokenError(str(exc)) from exc

    if payload.get("typ") != expected_typ:
        raise TokenError(f"unexpected token typ: {payload.get('typ')!r}")

    sub = payload.get("sub")
    if not isinstance(sub, str) or not sub:
        raise TokenError("token missing 'sub'")

    return TokenPayload(
        subject=sub,
        is_super_admin=bool(payload.get("is_super_admin", False)),
        jti=str(payload.get("jti", "")),
        issued_at=datetime.fromtimestamp(int(payload["iat"]), tz=timezone.utc),
        expires_at=datetime.fromtimestamp(int(payload["exp"]), tz=timezone.utc),
    )


def hash_password(plain: str) -> str:
    return _password_hasher.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return _password_hasher.verify(hashed, plain)
    except (VerifyMismatchError, Exception):  # noqa: BLE001
        return False


def generate_csrf_token() -> str:
    return secrets.token_urlsafe(24)

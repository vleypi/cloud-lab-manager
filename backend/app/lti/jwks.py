import asyncio
import time
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path
from typing import Any

import httpx
import jwt
from cryptography.hazmat.primitives import serialization
from jwt import PyJWK

from app.config import get_settings
from app.core.exceptions import OrchestratorError


class LtiSecurityError(OrchestratorError):
    http_status = 401
    code = "lti_security_error"


@dataclass(slots=True)
class _CachedJWKS:
    raw: dict[str, Any]
    fetched_at: float = field(default_factory=time.monotonic)


_JWKS_CACHE: dict[str, _CachedJWKS] = {}
_JWKS_TTL_SECONDS = 600.0
_JWKS_LOCK = asyncio.Lock()


# получить JWKS платформы с in-memory кэшем на 10 минут
async def fetch_platform_jwks(jwks_url: str) -> dict[str, Any]:
    cached = _JWKS_CACHE.get(jwks_url)
    if cached and (time.monotonic() - cached.fetched_at) < _JWKS_TTL_SECONDS:
        return cached.raw
    async with _JWKS_LOCK:
        cached = _JWKS_CACHE.get(jwks_url)
        if cached and (time.monotonic() - cached.fetched_at) < _JWKS_TTL_SECONDS:
            return cached.raw
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.get(jwks_url)
            response.raise_for_status()
            data = response.json()
        if "keys" not in data:
            raise LtiSecurityError(
                "Platform JWKS endpoint returned an invalid document",
                details={"jwks_url": jwks_url},
            )
        _JWKS_CACHE[jwks_url] = _CachedJWKS(raw=data)
        return data


# найти JWK по kid или вернуть единственный ключ если kid не задан
def pick_signing_key(jwks: dict[str, Any], kid: str | None) -> PyJWK:
    keys = jwks.get("keys") or []
    if not keys:
        raise LtiSecurityError("Platform JWKS has no keys")
    if kid is None:
        if len(keys) == 1:
            return PyJWK(keys[0])
        raise LtiSecurityError("id_token header has no kid and JWKS has multiple keys")
    for entry in keys:
        if entry.get("kid") == kid:
            return PyJWK(entry)
    raise LtiSecurityError("No JWK matched the id_token kid", details={"kid": kid})


@lru_cache(maxsize=1)
def _load_tool_private_pem() -> bytes:
    settings = get_settings()
    path = Path(settings.lti_tool_private_key_path)
    if not path.exists():
        raise LtiSecurityError(
            "Tool private key not found, generate it once and re-deploy",
            details={"path": str(path)},
        )
    return path.read_bytes()


@lru_cache(maxsize=1)
def _load_tool_public_pem() -> bytes:
    settings = get_settings()
    path = Path(settings.lti_tool_public_key_path)
    if not path.exists():
        raise LtiSecurityError(
            "Tool public key not found",
            details={"path": str(path)},
        )
    return path.read_bytes()


# публичный JWKS нашего tool отдаётся по GET /api/v1/lti/jwks.json
def tool_jwks() -> dict[str, Any]:
    settings = get_settings()
    public_pem = _load_tool_public_pem()
    public_key = serialization.load_pem_public_key(public_pem)
    algorithm = jwt.algorithms.RSAAlgorithm(jwt.algorithms.RSAAlgorithm.SHA256)
    jwk = algorithm.to_jwk(public_key, as_dict=True)
    jwk.update({"alg": "RS256", "use": "sig", "kid": settings.lti_tool_kid})
    return {"keys": [jwk]}


# подписать исходящий JWT приватным ключом tool для AGS NRPS scope-токенов
def sign_tool_jwt(payload: dict[str, Any]) -> str:
    settings = get_settings()
    return jwt.encode(
        payload,
        _load_tool_private_pem(),
        algorithm="RS256",
        headers={"kid": settings.lti_tool_kid},
    )

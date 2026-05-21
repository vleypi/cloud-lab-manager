from dataclasses import dataclass
from typing import Any

import jwt
import structlog

from app.lti.claims import (
    CL_CONTEXT,
    CL_CUSTOM,
    CL_DEPLOYMENT_ID,
    CL_MESSAGE_TYPE,
    CL_RESOURCE_LINK,
    CL_ROLES,
    CL_TARGET_LINK_URI,
    CL_VERSION,
    LTI_VERSION,
    MESSAGE_TYPE_RESOURCE_LINK,
    is_teacher,
)
from app.lti.jwks import LtiSecurityError, fetch_platform_jwks, pick_signing_key
from app.models.lti import LtiPlatform

logger = structlog.get_logger(__name__)


@dataclass(slots=True)
class LaunchClaims:
    issuer: str
    audience: str
    subject: str
    name: str | None
    email: str | None
    deployment_id: str
    target_link_uri: str
    context_id: str | None
    context_title: str | None
    resource_link_id: str
    resource_link_title: str | None
    is_teacher: bool
    custom: dict[str, Any]
    raw: dict[str, Any]


# полная проверка id_token и сборка структуры claims для запуска стенда
async def validate_id_token(
    *,
    id_token: str,
    expected_nonce: str,
    platform: LtiPlatform,
) -> LaunchClaims:
    try:
        header = jwt.get_unverified_header(id_token)
    except jwt.PyJWTError as exc:
        raise LtiSecurityError(
            "id_token header is malformed", details={"error": str(exc)}
        ) from exc

    jwks = await fetch_platform_jwks(platform.jwks_url)
    signing_key = pick_signing_key(jwks, header.get("kid"))

    try:
        payload = jwt.decode(
            id_token,
            signing_key.key,
            algorithms=["RS256", "RS384", "RS512"],
            audience=platform.client_id,
            issuer=platform.issuer,
            options={"require": ["exp", "iat", "iss", "aud", "sub"]},
        )
    except jwt.PyJWTError as exc:
        raise LtiSecurityError(
            "id_token failed signature/claim verification",
            details={"error": str(exc)},
        ) from exc

    nonce = payload.get("nonce")
    if not nonce or nonce != expected_nonce:
        raise LtiSecurityError("id_token nonce does not match stored state")

    if payload.get(CL_VERSION) != LTI_VERSION:
        raise LtiSecurityError(
            "Unsupported LTI version",
            details={"version": payload.get(CL_VERSION)},
        )
    if payload.get(CL_MESSAGE_TYPE) != MESSAGE_TYPE_RESOURCE_LINK:
        raise LtiSecurityError(
            "Unsupported message_type",
            details={"message_type": payload.get(CL_MESSAGE_TYPE)},
        )

    deployment_id = str(payload.get(CL_DEPLOYMENT_ID, ""))
    allowed = platform.allowed_deployments()
    if not allowed:
        raise LtiSecurityError(
            "Platform has no allowed deployment_ids, refusing to trust the launch",
            details={"platform_id": str(platform.id)},
        )
    if deployment_id not in allowed:
        raise LtiSecurityError(
            "deployment_id is not registered for this platform",
            details={"deployment_id": deployment_id},
        )

    target_link_uri = str(payload.get(CL_TARGET_LINK_URI, ""))
    resource_link = payload.get(CL_RESOURCE_LINK) or {}
    context = payload.get(CL_CONTEXT) or {}
    custom = payload.get(CL_CUSTOM) or {}
    roles_raw = payload.get(CL_ROLES) or []
    roles = [str(r) for r in roles_raw] if isinstance(roles_raw, list) else []

    return LaunchClaims(
        issuer=payload["iss"],
        audience=str(payload["aud"])
        if not isinstance(payload["aud"], list)
        else str(payload["aud"][0]),
        subject=str(payload["sub"]),
        name=payload.get("name"),
        email=payload.get("email"),
        deployment_id=deployment_id,
        target_link_uri=target_link_uri,
        context_id=str(context.get("id")) if context.get("id") else None,
        context_title=context.get("title"),
        resource_link_id=str(resource_link.get("id", "")),
        resource_link_title=resource_link.get("title"),
        is_teacher=is_teacher(roles),
        custom=custom if isinstance(custom, dict) else {},
        raw=payload,
    )

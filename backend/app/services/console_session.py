from dataclasses import dataclass
from typing import Literal
from uuid import UUID

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.core.exceptions import ConsoleNotAvailableError
from app.models.stand import Stand, StandStatus
from app.services.console_catalog import (
    ConsoleProfile,
    resolve_console_profile,
)
from app.services.credentials_store import CredentialsStore, StandCredentials

logger = structlog.get_logger(__name__)


GuacProtocol = Literal["ssh", "vnc", "rdp"]


@dataclass(slots=True, frozen=True)
class GuacdConnection:
    protocol: GuacProtocol
    hostname: str
    port: int
    username: str | None
    password: str | None
    private_key: str | None
    width: int
    height: int
    dpi: int

    def to_handshake_params(self) -> dict[str, str]:
        params: dict[str, str] = {
            "hostname": self.hostname,
            "port": str(self.port),
        }
        if self.username:
            params["username"] = self.username
        if self.password:
            params["password"] = self.password
        if self.protocol == "ssh":
            if self.private_key:
                params["private-key"] = self.private_key
        if self.protocol == "rdp":
            params["ignore-cert"] = "true"
            params["security"] = "any"
            params["resize-method"] = "display-update"
        if self.protocol == "vnc":
            params["color-depth"] = "24"
        return params


class ConsoleSessionBuilder:
    def __init__(
        self,
        session: AsyncSession,
        *,
        credentials_store: CredentialsStore,
    ) -> None:
        self._session = session
        self._creds = credentials_store

    async def build(
        self,
        stand_id: UUID,
        *,
        owner_external_id: str,
        is_super_admin: bool,
        width: int | None = None,
        height: int | None = None,
        dpi: int | None = None,
    ) -> GuacdConnection:
        stand = await self._session.scalar(select(Stand).where(Stand.id == stand_id))
        if stand is None:
            raise ConsoleNotAvailableError(
                "Stand not found",
                details={"stand_id": str(stand_id)},
            )

        if not is_super_admin and stand.owner_external_id != owner_external_id:
            raise ConsoleNotAvailableError(
                "Forbidden",
                details={"reason": "not_owner"},
            )

        if stand.status != StandStatus.READY:
            raise ConsoleNotAvailableError(
                "Stand is not ready",
                details={"status": stand.status.value},
            )

        host = _pick_host(stand)
        if not host:
            logger.warning(
                "console_no_host",
                stand_id=str(stand_id),
                ki_floating_ip=stand.ki_floating_ip,
                extra_keys=list((stand.extra or {}).keys()),
                fixed_ips=(stand.extra or {}).get("fixed_ips"),
            )
            raise ConsoleNotAvailableError(
                "Stand has no reachable address",
                details={
                    "stand_id": str(stand_id),
                    "ki_floating_ip": stand.ki_floating_ip,
                    "fixed_ips": (stand.extra or {}).get("fixed_ips"),
                },
            )

        creds: StandCredentials | None = await self._creds.get(str(stand_id))
        if creds is None:
            raise ConsoleNotAvailableError(
                "Credentials not available",
                details={"stand_id": str(stand_id)},
            )

        profile = _resolve_profile(stand)
        settings = get_settings()

        username = profile.username or _default_username(profile.protocol)
        password = creds.console_password
        private_key = creds.ssh_private_key if profile.protocol == "ssh" else None

        if profile.protocol in ("vnc", "rdp") and not password:
            raise ConsoleNotAvailableError(
                "Console password not provisioned for this protocol",
                details={"protocol": profile.protocol},
            )

        return GuacdConnection(
            protocol=profile.protocol,
            hostname=host,
            port=profile.port,
            username=username,
            password=password,
            private_key=private_key,
            width=width or settings.console_default_width,
            height=height or settings.console_default_height,
            dpi=dpi or settings.console_default_dpi,
        )


def _pick_host(stand: Stand) -> str | None:
    if stand.ki_floating_ip:
        return stand.ki_floating_ip
    extra = stand.extra or {}
    fixed = extra.get("fixed_ips") or []
    if isinstance(fixed, list) and fixed:
        return str(fixed[0])
    return None


def _resolve_profile(stand: Stand) -> ConsoleProfile:
    extra = stand.extra or {}
    console_data = extra.get("console")
    if isinstance(console_data, dict):
        return ConsoleProfile.from_dict(console_data)
    return resolve_console_profile(stand.image_id)


def _default_username(protocol: str) -> str:
    return {"ssh": "ubuntu", "rdp": "student", "vnc": ""}.get(protocol, "")

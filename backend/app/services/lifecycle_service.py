from datetime import datetime, timedelta, timezone
from uuid import UUID

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import OrchestratorError, StandNotFoundError
from app.core.state_machine import assert_transition
from app.models.runtime_settings import KEY_DEFAULT_TTL, KEY_FREEZE_TTL
from app.models.stand import Stand, StandStatus
from app.services.credentials_store import CredentialsStore
from app.services.lifecycle_settings import LifecycleSettings

logger = structlog.get_logger(__name__)


class StandNotActiveError(OrchestratorError):
    http_status = 409
    code = "stand_not_active"


class LifecycleService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session
        self._settings = LifecycleSettings(session)
        self._credentials = CredentialsStore()

    async def _sync_credentials_ttl(self, stand_id: UUID, ttl_seconds: int) -> None:
        try:
            await self._credentials.refresh_ttl(str(stand_id), ttl_seconds)
        except Exception as exc:  
            logger.warning(
                "credentials_ttl_refresh_failed",
                stand_id=str(stand_id),
                error=str(exc),
            )

    async def _get(self, stand_id: UUID) -> Stand:
        stand = await self._session.scalar(select(Stand).where(Stand.id == stand_id))
        if stand is None:
            raise StandNotFoundError("Stand not found", details={"stand_id": str(stand_id)})
        return stand

    async def freeze(
        self,
        stand_id: UUID,
        *,
        reason: str | None = None,
        requested_by: str | None = None,
    ) -> Stand:
        stand = await self._get(stand_id)
        if stand.status != StandStatus.READY:
            raise StandNotActiveError(
                "Only READY stands can be frozen",
                details={"stand_id": str(stand_id), "status": stand.status.value},
            )

        freeze_ttl = await self._settings.get_int(KEY_FREEZE_TTL)
        now = datetime.now(timezone.utc)

        assert_transition(stand.status, StandStatus.FROZEN)
        stand.status = StandStatus.FROZEN
        stand.frozen_at = now
        stand.frozen_reason = (reason or "Technical support requested")[:1024]
        stand.expires_at = now + timedelta(seconds=freeze_ttl)
        stand.extra = {
            **(stand.extra or {}),
            "frozen_by": requested_by,
        }
        await self._session.commit()
        await self._session.refresh(stand, ["pool_project", "updated_at"])
        await self._sync_credentials_ttl(stand_id, freeze_ttl)
        logger.info(
            "stand_frozen",
            stand_id=str(stand_id),
            requested_by=requested_by,
            freeze_ttl=freeze_ttl,
        )
        return stand

    async def report_incident(
        self,
        stand_id: UUID,
        *,
        description: str,
        reported_by: str | None = None,
    ) -> Stand:
        stand = await self._get(stand_id)
        if stand.status != StandStatus.READY:
            raise StandNotActiveError(
                "Only READY stands accept incident reports",
                details={"stand_id": str(stand_id), "status": stand.status.value},
            )

        freeze_ttl = await self._settings.get_int(KEY_FREEZE_TTL)
        now = datetime.now(timezone.utc)

        assert_transition(stand.status, StandStatus.FROZEN)
        stand.status = StandStatus.FROZEN
        stand.frozen_at = now
        stand.frozen_reason = description[:1024]
        stand.expires_at = now + timedelta(seconds=freeze_ttl)
        stand.extra = {
            **(stand.extra or {}),
            "incident_reported": True,
            "incident_reported_by": reported_by,
            "incident_reported_at": now.isoformat(),
            "incident_description": description[:2000],
        }
        await self._session.commit()
        await self._session.refresh(stand, ["pool_project", "updated_at"])
        await self._sync_credentials_ttl(stand_id, freeze_ttl)
        logger.info(
            "stand_incident_reported",
            stand_id=str(stand_id),
            reported_by=reported_by,
            freeze_ttl=freeze_ttl,
        )
        return stand

    async def unfreeze(
        self,
        stand_id: UUID,
        *,
        new_ttl_seconds: int | None = None,
        requested_by: str | None = None,
    ) -> Stand:
        stand = await self._get(stand_id)
        if stand.status != StandStatus.FROZEN:
            raise StandNotActiveError(
                "Only FROZEN stands can be unfrozen",
                details={"stand_id": str(stand_id), "status": stand.status.value},
            )

        ttl = new_ttl_seconds or await self._settings.get_int(KEY_DEFAULT_TTL)
        now = datetime.now(timezone.utc)
        assert_transition(stand.status, StandStatus.READY)
        stand.status = StandStatus.READY
        stand.frozen_at = None
        stand.frozen_reason = None
        stand.expires_at = now + timedelta(seconds=ttl)
        new_extra = {
            **(stand.extra or {}),
            "unfrozen_by": requested_by,
        }
        for key in ("incident_reported", "incident_reported_by", "incident_reported_at", "incident_description"):
            new_extra.pop(key, None)
        stand.extra = new_extra
        await self._session.commit()
        await self._session.refresh(stand, ["pool_project", "updated_at"])
        await self._sync_credentials_ttl(stand_id, ttl)
        logger.info(
            "stand_unfrozen",
            stand_id=str(stand_id),
            requested_by=requested_by,
            ttl_seconds=ttl,
        )
        return stand

    async def extend(
        self,
        stand_id: UUID,
        *,
        new_ttl_seconds: int,
        requested_by: str | None = None,
    ) -> Stand:
        if new_ttl_seconds <= 0:
            raise OrchestratorError(
                "TTL must be positive", details={"new_ttl_seconds": new_ttl_seconds}
            )
        stand = await self._get(stand_id)
        if stand.status not in (StandStatus.READY, StandStatus.FROZEN):
            raise StandNotActiveError(
                "Only active stands can be extended",
                details={"stand_id": str(stand_id), "status": stand.status.value},
            )
        stand.expires_at = datetime.now(timezone.utc) + timedelta(seconds=new_ttl_seconds)
        stand.extra = {
            **(stand.extra or {}),
            "extended_by": requested_by,
        }
        await self._session.commit()
        await self._session.refresh(stand, ["pool_project", "updated_at"])
        await self._sync_credentials_ttl(stand_id, new_ttl_seconds)
        logger.info(
            "stand_extended",
            stand_id=str(stand_id),
            ttl_seconds=new_ttl_seconds,
            requested_by=requested_by,
        )
        return stand

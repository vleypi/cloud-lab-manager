from __future__ import annotations

from datetime import datetime
from typing import Any

import structlog
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import CapacityExceededError
from app.models.capacity_audit import CapacityRejection

logger = structlog.get_logger(__name__)


def _safe_float(value: Any) -> float | None:
    try:
        if value is None:
            return None
        return float(value)
    except (TypeError, ValueError):
        return None


def _safe_int(value: Any) -> int | None:
    try:
        if value is None:
            return None
        return int(value)
    except (TypeError, ValueError):
        return None


class CapacityAuditRecorder:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def record_from_exception(
        self,
        *,
        owner_external_id: str,
        owner_display_name: str | None,
        course_code: str | None,
        lab_code: str | None,
        image_id: str | None,
        flavor_id: str | None,
        exc: CapacityExceededError,
    ) -> CapacityRejection:
        return await self.record(
            owner_external_id=owner_external_id,
            owner_display_name=owner_display_name,
            course_code=course_code,
            lab_code=lab_code,
            image_id=image_id,
            flavor_id=flavor_id,
            reason=exc.message,
            details=exc.details or {},
        )

    async def record(
        self,
        *,
        owner_external_id: str,
        owner_display_name: str | None,
        course_code: str | None,
        lab_code: str | None,
        image_id: str | None,
        flavor_id: str | None,
        reason: str,
        details: dict,
    ) -> CapacityRejection:
        utilization = details.get("utilization") or {}
        vcpus = utilization.get("vcpus") or {}
        memory = utilization.get("memory_mb") or {}
        local = utilization.get("local_gb") or {}
        flavor = details.get("flavor") or {}

        row = CapacityRejection(
            owner_external_id=owner_external_id,
            owner_display_name=owner_display_name,
            course_code=course_code,
            lab_code=lab_code,
            image_id=image_id,
            flavor_id=flavor_id,
            flavor_vcpus=_safe_int(flavor.get("vcpus")),
            flavor_ram_mb=_safe_int(flavor.get("ram_mb")),
            flavor_disk_gb=_safe_int(flavor.get("disk_gb")),
            threshold_percent=_safe_float(details.get("threshold_percent")) or 0.0,
            current_max_percent=_safe_float(utilization.get("max_percent")) or 0.0,
            projected_max_percent=_safe_float(details.get("projected_max_percent")),
            vcpus_used=_safe_float(vcpus.get("used")),
            vcpus_total=_safe_float(vcpus.get("total")),
            memory_mb_used=_safe_float(memory.get("used")),
            memory_mb_total=_safe_float(memory.get("total")),
            local_gb_used=_safe_float(local.get("used")),
            local_gb_total=_safe_float(local.get("total")),
            running_vms=_safe_int(utilization.get("running_vms")),
            reason=reason,
            raw_details=details,
        )

        try:
            self._session.add(row)
            await self._session.commit()
            await self._session.refresh(row)
        except Exception as persist_exc:
            try:
                await self._session.rollback()
            except Exception:
                pass
            logger.error(
                "capacity_audit_persist_failed",
                owner=owner_external_id,
                error=str(persist_exc)[:200],
            )
            return row

        logger.info(
            "capacity_rejection_recorded",
            rejection_id=str(row.id),
            owner=owner_external_id,
            threshold=row.threshold_percent,
            projected=row.projected_max_percent,
        )
        return row


class CapacityAuditReader:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def list_recent(
        self,
        *,
        limit: int = 100,
        offset: int = 0,
        owner_external_id: str | None = None,
        since: datetime | None = None,
    ) -> list[CapacityRejection]:
        stmt = select(CapacityRejection).order_by(desc(CapacityRejection.created_at))
        if owner_external_id is not None:
            stmt = stmt.where(CapacityRejection.owner_external_id == owner_external_id)
        if since is not None:
            stmt = stmt.where(CapacityRejection.created_at >= since)
        stmt = stmt.limit(min(max(limit, 1), 500)).offset(max(offset, 0))
        return list((await self._session.scalars(stmt)).all())

    async def count(
        self,
        *,
        owner_external_id: str | None = None,
        since: datetime | None = None,
    ) -> int:
        stmt = select(func.count(CapacityRejection.id))
        if owner_external_id is not None:
            stmt = stmt.where(CapacityRejection.owner_external_id == owner_external_id)
        if since is not None:
            stmt = stmt.where(CapacityRejection.created_at >= since)
        return int((await self._session.scalar(stmt)) or 0)

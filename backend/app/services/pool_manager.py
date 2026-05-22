from datetime import datetime, timezone
from uuid import UUID

import re

import structlog
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import (
    AlreadyAllocatedError,
    PoolExhaustedError,
)
from app.models.project import PoolProject, ProjectStatus
from app.models.stand import Stand, StandStatus

logger = structlog.get_logger(__name__)

_OPENSTACK_ID_RE = re.compile(
    r"^[0-9a-fA-F]{32}$|^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$"
)

_ACTIVE_STATUSES: tuple[StandStatus, ...] = (
    StandStatus.ALLOCATING,
    StandStatus.DEPLOYING,
    StandStatus.READY,
    StandStatus.FROZEN,
    StandStatus.CLEANING,
)


class PoolManager:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def allocate(
        self,
        *,
        owner_external_id: str,
        course_code: str | None = None,
    ) -> PoolProject:
        await self._guard_no_active_stand(owner_external_id)

        stmt = (
            select(PoolProject)
            .where(PoolProject.status == ProjectStatus.FREE)
            .order_by(
                PoolProject.last_released_at.asc().nulls_first(),
                PoolProject.created_at.asc(),
            )
            .with_for_update(skip_locked=True)
        )
        if course_code:
            stmt = stmt.where(PoolProject.ki_domain_name == course_code)

        candidates = (await self._session.scalars(stmt)).all()
        project = next(
            (
                c
                for c in candidates
                if _OPENSTACK_ID_RE.match((c.ki_project_id or "").strip())
            ),
            None,
        )
        if project is None:
            logger.warning("pool_exhausted", owner=owner_external_id, course=course_code)
            raise PoolExhaustedError(
                "No free projects available in the KI pool",
                details={"course_code": course_code},
            )

        project.status = ProjectStatus.ALLOCATED
        await self._session.flush()
        logger.info(
            "pool_allocated",
            owner=owner_external_id,
            project_id=str(project.id),
            ki_project=project.ki_project_name,
            domain=project.ki_domain_name,
        )
        return project

    async def release(
        self,
        project_id: UUID,
        *,
        to_status: ProjectStatus = ProjectStatus.CLEANING,
    ) -> None:
        stmt = (
            update(PoolProject)
            .where(PoolProject.id == project_id)
            .values(status=to_status)
        )
        await self._session.execute(stmt)
        logger.info("pool_released", project_id=str(project_id), to_status=to_status.value)

    async def mark_free(self, project_id: UUID) -> None:
        stmt = (
            update(PoolProject)
            .where(PoolProject.id == project_id)
            .values(
                status=ProjectStatus.FREE,
                last_released_at=datetime.now(timezone.utc),
            )
        )
        await self._session.execute(stmt)
        logger.info("pool_marked_free", project_id=str(project_id))

    async def inventory(self) -> dict[str, int]:
        counts: dict[str, int] = {ps.value: 0 for ps in ProjectStatus}
        result = await self._session.execute(select(PoolProject.status))
        for (status,) in result.all():
            counts[status.value] += 1
        return counts

    async def get_free_count(self, course_code: str | None = None) -> int:
        stmt = (
            select(func.count())
            .select_from(PoolProject)
            .where(PoolProject.status == ProjectStatus.FREE)
        )
        if course_code:
            stmt = stmt.where(PoolProject.ki_domain_name == course_code)
        return (await self._session.scalar(stmt)) or 0

    async def _guard_no_active_stand(self, owner_external_id: str) -> None:
        stmt = (
            select(Stand.id)
            .where(Stand.owner_external_id == owner_external_id)
            .where(Stand.status.in_(_ACTIVE_STATUSES))
            .limit(1)
        )
        existing = await self._session.scalar(stmt)
        if existing is not None:
            raise AlreadyAllocatedError(
                "This user already holds an active stand",
                details={"owner_external_id": owner_external_id, "stand_id": str(existing)},
            )

import asyncio
from dataclasses import dataclass
from uuid import UUID

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import (
    CapacityExceededError,
    CloudProviderError,
    StandNotFoundError,
)
from app.core.state_machine import is_active
from app.models.runtime_settings import KEY_CAPACITY_THRESHOLD
from app.models.stand import Stand, StandStatus
from app.providers import CloudProvider, get_cloud_provider
from app.services.capacity_audit import CapacityAuditRecorder
from app.services.capacity_checker import CapacityChecker, FlavorRequirements
from app.services.lifecycle_settings import LifecycleSettings
from app.services.pool_manager import PoolManager

logger = structlog.get_logger(__name__)


@dataclass(slots=True)
class StandLaunchRequest:
    owner_external_id: str
    image_id: str
    flavor_id: str
    owner_display_name: str | None = None
    course_code: str | None = None
    lab_code: str | None = None
    attach_floating_ip: bool = True


@dataclass(slots=True)
class StandLaunchAccepted:
    stand: Stand
    task_id: str


class StandService:
    def __init__(
        self,
        session: AsyncSession,
        *,
        provider: CloudProvider | None = None,
        capacity: CapacityChecker | None = None,
    ) -> None:
        self._session = session
        self._provider = provider or get_cloud_provider()
        self._capacity = capacity or CapacityChecker(self._provider)
        self._pool = PoolManager(session)
        self._settings = LifecycleSettings(session)

    async def launch(self, req: StandLaunchRequest) -> StandLaunchAccepted:
        threshold = await self._settings.get_float(KEY_CAPACITY_THRESHOLD)

        flavor_req: FlavorRequirements | None = None
        try:
            flavor = await self._provider.get_flavor(req.flavor_id)
            flavor_req = FlavorRequirements.from_flavor(flavor)
        except CloudProviderError as exc:
            logger.warning(
                "flavor_lookup_failed_falling_back_to_reactive_capacity",
                flavor_id=req.flavor_id,
                error=str(exc)[:200],
            )

        try:
            await self._capacity.assert_can_allocate(
                owner_external_id=req.owner_external_id,
                threshold_override=threshold,
                flavor=flavor_req,
                flavor_id=req.flavor_id,
            )
        except CapacityExceededError as exc:
            await CapacityAuditRecorder(self._session).record_from_exception(
                owner_external_id=req.owner_external_id,
                owner_display_name=req.owner_display_name,
                course_code=req.course_code,
                lab_code=req.lab_code,
                image_id=req.image_id,
                flavor_id=req.flavor_id,
                exc=exc,
            )
            raise

        project = await self._pool.allocate(
            owner_external_id=req.owner_external_id,
            course_code=req.course_code,
        )

        stand = Stand(
            owner_external_id=req.owner_external_id,
            owner_display_name=req.owner_display_name,
            pool_project=project,
            course_code=req.course_code,
            lab_code=req.lab_code,
            image_id=req.image_id,
            flavor_id=req.flavor_id,
            status=StandStatus.ALLOCATING,
            extra={"attach_floating_ip": req.attach_floating_ip},
        )
        self._session.add(stand)
        await self._session.flush()
        stand_id = str(stand.id)
        await self._session.commit()

        from app.tasks.stands import provision_stand

        async_result = await asyncio.to_thread(provision_stand.delay, stand_id)

        stand.task_id = async_result.id
        await self._session.commit()

        await self._session.refresh(stand, ["pool_project", "updated_at"])

        logger.info(
            "stand_accepted",
            stand_id=stand_id,
            owner=stand.owner_external_id,
            task_id=async_result.id,
            project=project.ki_project_name,
        )
        return StandLaunchAccepted(stand=stand, task_id=async_result.id)

    async def request_destroy(self, stand_id: UUID) -> tuple[Stand, str]:
        stand = await self.get(stand_id)
        if not is_active(stand.status):
            return stand, ""

        from app.tasks.stands import destroy_stand

        async_result = await asyncio.to_thread(destroy_stand.delay, str(stand_id))
        stand.task_id = async_result.id
        await self._session.commit()

        await self._session.refresh(stand, ["pool_project", "updated_at"])

        logger.info(
            "stand_destroy_requested",
            stand_id=str(stand_id),
            task_id=async_result.id,
        )
        return stand, async_result.id

    async def get(self, stand_id: UUID) -> Stand:
        stand = await self._session.scalar(select(Stand).where(Stand.id == stand_id))
        if stand is None:
            raise StandNotFoundError("Stand not found", details={"stand_id": str(stand_id)})
        return stand

    async def list_for_owner(self, owner_external_id: str) -> list[Stand]:
        stmt = (
            select(Stand)
            .where(Stand.owner_external_id == owner_external_id)
            .order_by(Stand.created_at.desc())
        )
        return list((await self._session.scalars(stmt)).all())

    async def list_all(
        self,
        *,
        status: StandStatus | None = None,
        limit: int = 200,
    ) -> list[Stand]:
        stmt = select(Stand).order_by(Stand.created_at.desc()).limit(limit)
        if status is not None:
            stmt = stmt.where(Stand.status == status)
        return list((await self._session.scalars(stmt)).all())

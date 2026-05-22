from dataclasses import dataclass
from uuid import UUID

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import OrchestratorError, StandNotFoundError
from app.inspector.loader import load as load_template
from app.models.check_run import CheckRun, CheckRunStatus
from app.models.stand import Stand, StandStatus

logger = structlog.get_logger(__name__)


class StandNotReadyError(OrchestratorError):
    http_status = 409
    code = "stand_not_ready"


class InspectorRunNotFoundError(OrchestratorError):
    http_status = 404
    code = "inspector_run_not_found"


@dataclass(slots=True)
class CheckScheduleResult:
    run: CheckRun
    task_id: str


class InspectorService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def _get_stand(self, stand_id: UUID) -> Stand:
        stand = await self._session.scalar(select(Stand).where(Stand.id == stand_id))
        if stand is None:
            raise StandNotFoundError("Stand not found", details={"stand_id": str(stand_id)})
        return stand

    async def schedule(
        self,
        stand_id: UUID,
        *,
        template_name: str,
        requested_by: str | None = None,
    ) -> CheckScheduleResult:
        stand = await self._get_stand(stand_id)
        if stand.status not in (StandStatus.READY, StandStatus.FROZEN):
            raise StandNotReadyError(
                "Stand is not ready for checks",
                details={"stand_id": str(stand_id), "status": stand.status.value},
            )
        if not stand.ki_floating_ip and not stand.extra.get("fixed_ips"):
            raise StandNotReadyError(
                "Stand has no reachable IP address",
                details={"stand_id": str(stand_id)},
            )

        template = load_template(template_name)

        run = CheckRun(
            stand_id=stand.id,
            template_name=template.name,
            template_version=template.version,
            requested_by=requested_by,
            status=CheckRunStatus.PENDING,
            total=len(template.checks),
        )
        self._session.add(run)
        await self._session.flush()
        run_id = str(run.id)
        await self._session.commit()

        from app.tasks.inspector import run_inspector

        async_result = run_inspector.delay(run_id, template_name)
        run.task_id = async_result.id
        await self._session.commit()
        logger.info(
            "inspector_scheduled",
            stand_id=str(stand_id),
            run_id=run_id,
            template=template.name,
            task_id=async_result.id,
        )
        return CheckScheduleResult(run=run, task_id=async_result.id)

    async def get_run(self, run_id: UUID) -> CheckRun:
        run = await self._session.scalar(select(CheckRun).where(CheckRun.id == run_id))
        if run is None:
            raise InspectorRunNotFoundError(
                "Inspector run not found", details={"run_id": str(run_id)}
            )
        return run

    async def list_for_stand(self, stand_id: UUID) -> list[CheckRun]:
        result = await self._session.execute(
            select(CheckRun)
            .where(CheckRun.stand_id == stand_id)
            .order_by(CheckRun.created_at.desc())
        )
        return list(result.scalars().all())

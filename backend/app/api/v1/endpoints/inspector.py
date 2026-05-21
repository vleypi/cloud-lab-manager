from uuid import UUID

from fastapi import APIRouter, Depends, Path, status
from pydantic import BaseModel

from app.api.deps import inspector_service
from app.inspector.loader import list_templates
from app.schemas.inspector import (
    CheckRunOut,
    CheckScheduleAcceptedOut,
    CheckScheduleIn,
)
from app.services.inspector_service import InspectorService

router = APIRouter(tags=["inspector"])


class InspectorTemplateOut(BaseModel):
    name: str
    display_name: str
    description: str | None = None
    version: str | None = None
    checks_count: int = 0


@router.get("/inspector/templates", response_model=list[InspectorTemplateOut])
async def list_inspector_templates() -> list[InspectorTemplateOut]:
    return [
        InspectorTemplateOut(
            name=str(t["name"]),
            display_name=str(t["display_name"]),
            description=t.get("description"),
            version=t.get("version"),
            checks_count=int(t.get("checks_count") or 0),
        )
        for t in list_templates()
    ]


@router.post(
    "/stands/{stand_id}/checks",
    response_model=CheckScheduleAcceptedOut,
    status_code=status.HTTP_202_ACCEPTED,
)
async def schedule_check(
    payload: CheckScheduleIn,
    stand_id: UUID = Path(...),
    service: InspectorService = Depends(inspector_service),
) -> CheckScheduleAcceptedOut:
    result = await service.schedule(
        stand_id,
        template_name=payload.template_name,
        requested_by=payload.requested_by,
    )
    return CheckScheduleAcceptedOut(
        run=CheckRunOut.from_orm_run(result.run, with_results=False),
        task_id=result.task_id,
    )


@router.get(
    "/stands/{stand_id}/checks",
    response_model=list[CheckRunOut],
)
async def list_runs(
    stand_id: UUID = Path(...),
    service: InspectorService = Depends(inspector_service),
) -> list[CheckRunOut]:
    runs = await service.list_for_stand(stand_id)
    return [CheckRunOut.from_orm_run(r, with_results=False) for r in runs]


@router.get(
    "/checks/{run_id}",
    response_model=CheckRunOut,
)
async def get_run(
    run_id: UUID = Path(...),
    service: InspectorService = Depends(inspector_service),
) -> CheckRunOut:
    run = await service.get_run(run_id)
    return CheckRunOut.from_orm_run(run, with_results=True)

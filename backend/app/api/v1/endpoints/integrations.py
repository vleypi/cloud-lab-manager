from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import db_session, stand_service
from app.config import get_settings
from app.core.exceptions import OrchestratorError
from app.models.lti import CourseMapping
from app.schemas.lti import MoodleRestLaunchIn, MoodleRestLaunchOut
from app.services.lti_service import CourseNotMappedError
from app.services.pending_lti_binding_service import record_unmapped_launch
from app.services.stand_service import StandLaunchRequest, StandService

router = APIRouter(prefix="/integrations/moodle", tags=["integrations"])


async def _resolve_mapping(
    session: AsyncSession, *, context_id: str, resource_link_id: str | None
) -> CourseMapping:
    stmt = select(CourseMapping).where(CourseMapping.lti_context_id == context_id)
    if resource_link_id:
        result = await session.execute(
            stmt.where(CourseMapping.resource_link_id == resource_link_id)
        )
        rows = list(result.scalars().all())
        if rows:
            return rows[0]
    fallback = await session.execute(stmt.where(CourseMapping.resource_link_id.is_(None)))
    rows = list(fallback.scalars().all())
    if not rows:
        raise CourseNotMappedError(
            "No CourseMapping for the given context",
            details={"context_id": context_id, "resource_link_id": resource_link_id},
        )
    return rows[0]


@router.post(
    "/launch",
    response_model=MoodleRestLaunchOut,
    status_code=status.HTTP_202_ACCEPTED,
)
async def rest_launch(
    payload: MoodleRestLaunchIn,
    session: AsyncSession = Depends(db_session),
    stands: StandService = Depends(stand_service),
) -> MoodleRestLaunchOut:
    settings = get_settings()
    try:
        mapping = await _resolve_mapping(
            session,
            context_id=payload.lti_context_id,
            resource_link_id=payload.resource_link_id,
        )
    except CourseNotMappedError:
        await record_unmapped_launch(
            session,
            lti_context_id=payload.lti_context_id,
            resource_link_id=payload.resource_link_id,
            context_title=payload.context_title,
            resource_link_title=payload.resource_link_title,
            user_external_id=payload.user_id,
            user_display_name=payload.user_display_name,
        )
        await session.commit()
        raise
    owner_id = f"moodle-rest:{payload.lti_context_id}:{payload.user_id}"
    try:
        accepted = await stands.launch(
            StandLaunchRequest(
                owner_external_id=owner_id,
                owner_display_name=payload.user_display_name,
                image_id=mapping.image_id,
                flavor_id=mapping.flavor_id,
                course_code=mapping.ki_domain_name,
                lab_code=mapping.lab_code,
                attach_floating_ip=True,
            )
        )
    except OrchestratorError:
        raise
    return MoodleRestLaunchOut(
        stand_id=accepted.stand.id,
        task_id=accepted.task_id,
        redirect_url=settings.lti_frontend_launch_url.format(stand_id=str(accepted.stand.id)),
    )

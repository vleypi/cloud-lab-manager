from dataclasses import asdict
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Path, Query, Request, status

from app.api.deps import (
    credentials_store,
    lifecycle_service,
    require_super_admin,
    stand_service,
)
from app.models.user import User
from app.schemas.lifecycle import ExtendIn, FreezeIn, ReportIncidentIn, UnfreezeIn
from app.schemas.stand import (
    StandActionAcceptedOut,
    StandCredentialsOut,
    StandLaunchAcceptedOut,
    StandLaunchIn,
    StandOut,
)
from app.services.credentials_store import CredentialsStore
from app.services.lifecycle_service import LifecycleService
from app.services.stand_service import (
    StandLaunchRequest,
    StandService,
)

router = APIRouter(prefix="/stands", tags=["stands"])


@router.post(
    "",
    response_model=StandLaunchAcceptedOut,
    status_code=status.HTTP_202_ACCEPTED,
)
async def launch_stand(
    payload: StandLaunchIn,
    request: Request,
    service: StandService = Depends(stand_service),
    _admin: User = Depends(require_super_admin),
) -> StandLaunchAcceptedOut:
    accepted = await service.launch(
        StandLaunchRequest(
            owner_external_id=payload.owner_external_id,
            owner_display_name=payload.owner_display_name,
            image_id=payload.image_id,
            flavor_id=payload.flavor_id,
            course_code=payload.course_code,
            lab_code=payload.lab_code,
            attach_floating_ip=payload.attach_floating_ip,
        )
    )
    creds_url = str(request.url_for("get_stand_credentials", stand_id=accepted.stand.id))
    return StandLaunchAcceptedOut(
        stand=StandOut.from_orm_stand(accepted.stand),
        task_id=accepted.task_id,
        credentials_url=creds_url,
    )


@router.get("/{stand_id}", response_model=StandOut)
async def get_stand(
    stand_id: UUID = Path(...),
    service: StandService = Depends(stand_service),
) -> StandOut:
    stand = await service.get(stand_id)
    return StandOut.from_orm_stand(stand)


@router.get("", response_model=list[StandOut])
async def list_stands(
    owner_external_id: str = Query(..., min_length=1),
    service: StandService = Depends(stand_service),
) -> list[StandOut]:
    stands = await service.list_for_owner(owner_external_id)
    return [StandOut.from_orm_stand(s) for s in stands]


@router.delete(
    "/{stand_id}",
    response_model=StandActionAcceptedOut,
    status_code=status.HTTP_202_ACCEPTED,
)
async def destroy_stand(
    stand_id: UUID = Path(...),
    service: StandService = Depends(stand_service),
) -> StandActionAcceptedOut:
    stand, task_id = await service.request_destroy(stand_id)
    return StandActionAcceptedOut(
        stand=StandOut.from_orm_stand(stand),
        task_id=task_id or None,
    )


@router.get(
    "/{stand_id}/credentials",
    response_model=StandCredentialsOut,
    name="get_stand_credentials",
)
async def get_stand_credentials(
    stand_id: UUID = Path(...),
    store: CredentialsStore = Depends(credentials_store),
) -> StandCredentialsOut:
    creds = await store.get(str(stand_id))
    if creds is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=("Credentials are not available — стенд ещё не готов или уже удалён."),
        )
    return StandCredentialsOut(**asdict(creds))


@router.post("/{stand_id}/freeze", response_model=StandOut)
async def freeze_stand(
    payload: FreezeIn,
    stand_id: UUID = Path(...),
    service: LifecycleService = Depends(lifecycle_service),
) -> StandOut:
    stand = await service.freeze(stand_id, reason=payload.reason, requested_by=payload.requested_by)
    return StandOut.from_orm_stand(stand)


@router.post("/{stand_id}/report-incident", response_model=StandOut)
async def report_stand_incident(
    payload: ReportIncidentIn,
    stand_id: UUID = Path(...),
    service: LifecycleService = Depends(lifecycle_service),
) -> StandOut:
    stand = await service.report_incident(
        stand_id,
        description=payload.description,
        reported_by=payload.reported_by,
    )
    return StandOut.from_orm_stand(stand)


@router.post("/{stand_id}/unfreeze", response_model=StandOut)
async def unfreeze_stand(
    payload: UnfreezeIn,
    stand_id: UUID = Path(...),
    service: LifecycleService = Depends(lifecycle_service),
) -> StandOut:
    stand = await service.unfreeze(
        stand_id,
        new_ttl_seconds=payload.new_ttl_seconds,
        requested_by=payload.requested_by,
    )
    return StandOut.from_orm_stand(stand)


@router.post("/{stand_id}/extend", response_model=StandOut)
async def extend_stand(
    payload: ExtendIn,
    stand_id: UUID = Path(...),
    service: LifecycleService = Depends(lifecycle_service),
) -> StandOut:
    stand = await service.extend(
        stand_id,
        new_ttl_seconds=payload.new_ttl_seconds,
        requested_by=payload.requested_by,
    )
    return StandOut.from_orm_stand(stand)

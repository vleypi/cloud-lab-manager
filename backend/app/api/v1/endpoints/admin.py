from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import db_session, lifecycle_settings, require_super_admin, stand_service
from app.models.runtime_settings import (
    KEY_CAPACITY_THRESHOLD,
    KEY_DEFAULT_TTL,
    KEY_FREEZE_TTL,
)
from app.models.stand import StandStatus
from app.models.user import User
from app.schemas.admin import (
    LifecycleSettingChangeOut,
    LifecycleSettingsHistoryOut,
    LifecycleSettingsOut,
    LifecycleSettingsPatchIn,
)
from app.schemas.capacity_audit import CapacityRejectionListOut, CapacityRejectionOut
from app.schemas.lti_user import LtiUserListOut, LtiUserOut
from app.schemas.stand import StandOut
from app.services.capacity_audit import CapacityAuditReader
from app.services.lifecycle_settings import LifecycleSettings
from app.services.lifecycle_settings_audit import LifecycleSettingsAuditReader
from app.services.lti_user_service import LtiUserReader
from app.services.stand_service import StandService

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/stands", response_model=list[StandOut])
async def list_all_stands(
    status: StandStatus | None = Query(default=None),
    limit: int = Query(default=200, ge=1, le=1000),
    service: StandService = Depends(stand_service),
    _: User = Depends(require_super_admin),
) -> list[StandOut]:
    stands = await service.list_all(status=status, limit=limit)
    return [StandOut.from_orm_stand(s) for s in stands]


async def _current_lifecycle_settings(settings: LifecycleSettings) -> LifecycleSettingsOut:
    values = await settings.all()
    return LifecycleSettingsOut(
        stand_default_ttl_seconds=int(values[KEY_DEFAULT_TTL]),
        stand_freeze_ttl_seconds=int(values[KEY_FREEZE_TTL]),
        capacity_threshold_percent=float(values[KEY_CAPACITY_THRESHOLD]),
    )


@router.get("/lifecycle-settings", response_model=LifecycleSettingsOut)
async def get_lifecycle_settings(
    settings: LifecycleSettings = Depends(lifecycle_settings),
    _: User = Depends(require_super_admin),
) -> LifecycleSettingsOut:
    return await _current_lifecycle_settings(settings)


@router.patch("/lifecycle-settings", response_model=LifecycleSettingsOut)
async def patch_lifecycle_settings(
    payload: LifecycleSettingsPatchIn,
    settings: LifecycleSettings = Depends(lifecycle_settings),
    user: User = Depends(require_super_admin),
) -> LifecycleSettingsOut:
    actor = user.external_id
    updates = {
        KEY_DEFAULT_TTL: payload.stand_default_ttl_seconds,
        KEY_FREEZE_TTL: payload.stand_freeze_ttl_seconds,
        KEY_CAPACITY_THRESHOLD: payload.capacity_threshold_percent,
    }
    for key, value in updates.items():
        if value is not None:
            await settings.set_value(key, str(value), updated_by=actor)
    return await _current_lifecycle_settings(settings)


@router.get(
    "/lifecycle-settings/history",
    response_model=LifecycleSettingsHistoryOut,
)
async def lifecycle_settings_history(
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    key: str | None = Query(default=None),
    session: AsyncSession = Depends(db_session),
    _: User = Depends(require_super_admin),
) -> LifecycleSettingsHistoryOut:
    reader = LifecycleSettingsAuditReader(session)
    rows = await reader.list_recent(limit=limit, offset=offset, key=key)
    total = await reader.count(key=key)
    return LifecycleSettingsHistoryOut(
        items=[LifecycleSettingChangeOut.from_orm_row(r) for r in rows],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get(
    "/audit/capacity-rejections",
    response_model=CapacityRejectionListOut,
)
async def list_capacity_rejections(
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    owner: str | None = Query(default=None),
    since: datetime | None = Query(default=None),
    session: AsyncSession = Depends(db_session),
    _: User = Depends(require_super_admin),
) -> CapacityRejectionListOut:
    reader = CapacityAuditReader(session)
    rows = await reader.list_recent(
        limit=limit,
        offset=offset,
        owner_external_id=owner,
        since=since,
    )
    total = await reader.count(owner_external_id=owner, since=since)
    return CapacityRejectionListOut(
        items=[CapacityRejectionOut.from_orm_row(r) for r in rows],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get(
    "/lti-users",
    response_model=LtiUserListOut,
)
async def list_lti_users(
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    platform_id: UUID | None = Query(default=None),
    search: str | None = Query(default=None, max_length=128),
    session: AsyncSession = Depends(db_session),
    _: User = Depends(require_super_admin),
) -> LtiUserListOut:
    reader = LtiUserReader(session)
    rows = await reader.list_recent(
        limit=limit,
        offset=offset,
        platform_id=platform_id,
        search=search,
    )
    total = await reader.count(platform_id=platform_id, search=search)
    return LtiUserListOut(
        items=[LtiUserOut.from_orm_row(r) for r in rows],
        total=total,
        limit=limit,
        offset=offset,
    )

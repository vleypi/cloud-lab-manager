from fastapi import APIRouter, Depends, Query

from app.api.deps import lifecycle_settings, stand_service
from app.models.runtime_settings import (
    KEY_CAPACITY_THRESHOLD,
    KEY_DEFAULT_TTL,
    KEY_FREEZE_TTL,
)
from app.models.stand import StandStatus
from app.schemas.admin import LifecycleSettingsOut, LifecycleSettingsPatchIn
from app.schemas.stand import StandOut
from app.services.lifecycle_settings import LifecycleSettings
from app.services.stand_service import StandService

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/stands", response_model=list[StandOut])
async def list_all_stands(
    status: StandStatus | None = Query(default=None),
    limit: int = Query(default=200, ge=1, le=1000),
    service: StandService = Depends(stand_service),
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
) -> LifecycleSettingsOut:
    return await _current_lifecycle_settings(settings)


@router.patch("/lifecycle-settings", response_model=LifecycleSettingsOut)
async def patch_lifecycle_settings(
    payload: LifecycleSettingsPatchIn,
    settings: LifecycleSettings = Depends(lifecycle_settings),
) -> LifecycleSettingsOut:
    updates = {
        KEY_DEFAULT_TTL: payload.stand_default_ttl_seconds,
        KEY_FREEZE_TTL: payload.stand_freeze_ttl_seconds,
        KEY_CAPACITY_THRESHOLD: payload.capacity_threshold_percent,
    }
    for key, value in updates.items():
        if value is not None:
            await settings.set_value(key, str(value), updated_by=payload.updated_by)
    return await _current_lifecycle_settings(settings)

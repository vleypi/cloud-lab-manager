from fastapi import APIRouter, Depends

from app.api.deps import capacity_checker, lifecycle_settings
from app.models.runtime_settings import KEY_CAPACITY_THRESHOLD
from app.schemas.capacity import CapacityDecisionOut
from app.services.capacity_checker import CapacityChecker
from app.services.lifecycle_settings import LifecycleSettings

router = APIRouter(prefix="/capacity", tags=["capacity"])


@router.get("", response_model=CapacityDecisionOut)
async def get_capacity(
    checker: CapacityChecker = Depends(capacity_checker),
    settings: LifecycleSettings = Depends(lifecycle_settings),
) -> CapacityDecisionOut:
    threshold = await settings.get_float(KEY_CAPACITY_THRESHOLD)
    decision = await checker.evaluate(threshold_override=threshold)
    return CapacityDecisionOut.from_decision(decision)

from pydantic import BaseModel, Field

from app.services.capacity_checker import CapacityDecision


class ResourceUsageOut(BaseModel):
    used: float
    total: float
    percent: float


class UtilizationOut(BaseModel):
    max_percent: float
    vcpus: ResourceUsageOut
    memory_mb: ResourceUsageOut
    local_gb: ResourceUsageOut
    running_vms: int


class CapacityDecisionOut(BaseModel):
    allowed: bool
    threshold_percent: float
    reason: str | None = None
    utilization: UtilizationOut

    @classmethod
    def from_decision(cls, decision: CapacityDecision) -> "CapacityDecisionOut":
        return cls.model_validate(decision.as_dict())


class PoolInventoryOut(BaseModel):
    free: int = Field(0)
    allocated: int = Field(0)
    cleaning: int = Field(0)
    disabled: int = Field(0)

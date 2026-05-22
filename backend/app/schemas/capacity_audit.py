from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from app.models.capacity_audit import CapacityRejection


class CapacityRejectionOut(BaseModel):
    id: UUID
    created_at: datetime
    owner_external_id: str
    owner_display_name: str | None = None
    course_code: str | None = None
    lab_code: str | None = None
    image_id: str | None = None
    flavor_id: str | None = None
    flavor_vcpus: int | None = None
    flavor_ram_mb: int | None = None
    flavor_disk_gb: int | None = None
    threshold_percent: float
    current_max_percent: float
    projected_max_percent: float | None = None
    vcpus_used: float | None = None
    vcpus_total: float | None = None
    memory_mb_used: float | None = None
    memory_mb_total: float | None = None
    local_gb_used: float | None = None
    local_gb_total: float | None = None
    running_vms: int | None = None
    reason: str

    @classmethod
    def from_orm_row(cls, row: CapacityRejection) -> "CapacityRejectionOut":
        return cls(
            id=row.id,
            created_at=row.created_at,
            owner_external_id=row.owner_external_id,
            owner_display_name=row.owner_display_name,
            course_code=row.course_code,
            lab_code=row.lab_code,
            image_id=row.image_id,
            flavor_id=row.flavor_id,
            flavor_vcpus=row.flavor_vcpus,
            flavor_ram_mb=row.flavor_ram_mb,
            flavor_disk_gb=row.flavor_disk_gb,
            threshold_percent=row.threshold_percent,
            current_max_percent=row.current_max_percent,
            projected_max_percent=row.projected_max_percent,
            vcpus_used=row.vcpus_used,
            vcpus_total=row.vcpus_total,
            memory_mb_used=row.memory_mb_used,
            memory_mb_total=row.memory_mb_total,
            local_gb_used=row.local_gb_used,
            local_gb_total=row.local_gb_total,
            running_vms=row.running_vms,
            reason=row.reason,
        )


class CapacityRejectionListOut(BaseModel):
    items: list[CapacityRejectionOut] = Field(default_factory=list)
    total: int = 0
    limit: int = 100
    offset: int = 0

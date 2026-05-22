import re
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.project import PoolProject, ProjectStatus

_OPENSTACK_ID_RE = re.compile(
    r"^[0-9a-fA-F]{32}$|^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$"
)


def _validate_openstack_id(value: str, field: str) -> str:
    v = (value or "").strip()
    if not _OPENSTACK_ID_RE.match(v):
        raise ValueError(f"{field} must be an OpenStack ID (32 hex chars) or UUID, got {value!r}")
    return v


class PoolProjectIn(BaseModel):
    ki_project_id: str = Field(..., min_length=1, max_length=64)
    ki_project_name: str = Field(..., min_length=1, max_length=128)
    ki_domain_id: str = Field(..., min_length=1, max_length=64)
    ki_domain_name: str = Field(..., min_length=1, max_length=128)
    ki_network_id: str | None = Field(default=None, max_length=64)
    ki_router_id: str | None = Field(default=None, max_length=64)

    @field_validator("ki_project_id")
    @classmethod
    def _project_id_is_openstack(cls, v: str) -> str:
        return _validate_openstack_id(v, "ki_project_id")

    @field_validator("ki_domain_id")
    @classmethod
    def _domain_id_is_openstack(cls, v: str) -> str:
        return _validate_openstack_id(v, "ki_domain_id")

    @field_validator("ki_network_id", "ki_router_id")
    @classmethod
    def _optional_openstack_id(cls, v: str | None) -> str | None:
        # None и пустую строку трактуем как «не задано», иначе требуем формат OpenStack ID
        if v is None or not v.strip():
            return None
        return _validate_openstack_id(v, "ki_network_id/ki_router_id")


class PoolProjectOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    ki_project_id: str
    ki_project_name: str
    ki_domain_id: str
    ki_domain_name: str
    ki_network_id: str | None
    ki_router_id: str | None
    status: ProjectStatus
    last_released_at: datetime | None
    created_at: datetime
    updated_at: datetime

    @classmethod
    def from_orm_project(cls, p: PoolProject) -> "PoolProjectOut":
        return cls.model_validate(p)


class DiscoveredKiProject(BaseModel):
    ki_project_id: str
    ki_project_name: str
    ki_domain_id: str
    ki_domain_name: str
    ki_network_id: str | None = None
    ki_router_id: str | None = None
    already_in_pool: bool = False


class PoolBulkAddIn(BaseModel):
    projects: list[PoolProjectIn] = Field(..., min_length=1, max_length=500)


class PoolBulkAddOut(BaseModel):
    added: list[PoolProjectOut]
    skipped: list[str] = Field(
        default_factory=list,
        description="ki_project_id уже бывших в пуле или невалидных",
    )

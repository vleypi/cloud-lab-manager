from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.models.project import PoolProject, ProjectStatus


class PoolProjectIn(BaseModel):
    ki_project_id: str = Field(..., min_length=1, max_length=64)
    ki_project_name: str = Field(..., min_length=1, max_length=128)
    ki_domain_id: str = Field(..., min_length=1, max_length=64)
    ki_domain_name: str = Field(..., min_length=1, max_length=128)
    ki_network_id: str | None = Field(default=None, max_length=64)
    ki_router_id: str | None = Field(default=None, max_length=64)


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

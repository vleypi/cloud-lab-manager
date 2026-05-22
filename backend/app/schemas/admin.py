from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from app.models.lifecycle_audit import LifecycleSettingChange


class LifecycleSettingsOut(BaseModel):
    stand_default_ttl_seconds: int = Field(
        ..., description="TTL по умолчанию для новых стендов в секундах"
    )
    stand_freeze_ttl_seconds: int = Field(
        ..., description="Сколько стенд лежит во FROZEN до удаления sweep'ом"
    )
    capacity_threshold_percent: float = Field(
        ..., description="Загрузка кластера при которой запуски блокируются"
    )


class LifecycleSettingsPatchIn(BaseModel):
    stand_default_ttl_seconds: int | None = Field(default=None, gt=0, le=30 * 24 * 3600)
    stand_freeze_ttl_seconds: int | None = Field(default=None, gt=0, le=30 * 24 * 3600)
    capacity_threshold_percent: float | None = Field(default=None, gt=0.0, le=100.0)
    updated_by: str | None = Field(default=None, max_length=128)


class LifecycleSettingChangeOut(BaseModel):
    id: UUID
    created_at: datetime
    key: str
    old_value: str | None = None
    new_value: str
    updated_by: str | None = None

    @classmethod
    def from_orm_row(cls, row: LifecycleSettingChange) -> "LifecycleSettingChangeOut":
        return cls(
            id=row.id,
            created_at=row.created_at,
            key=row.key,
            old_value=row.old_value,
            new_value=row.new_value,
            updated_by=row.updated_by,
        )


class LifecycleSettingsHistoryOut(BaseModel):
    items: list[LifecycleSettingChangeOut] = Field(default_factory=list)
    total: int = 0
    limit: int = 100
    offset: int = 0

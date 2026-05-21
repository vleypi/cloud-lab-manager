from pydantic import BaseModel, Field


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

from pydantic import BaseModel, Field


class FreezeIn(BaseModel):
    reason: str | None = Field(
        default=None,
        max_length=1024,
        description="Причина заморозки которая будет показана преподавателю",
    )
    requested_by: str | None = Field(
        default=None,
        max_length=128,
        description="Внешний id того кто запросил заморозку",
    )


class ReportIncidentIn(BaseModel):
    description: str = Field(
        ...,
        min_length=10,
        max_length=2000,
        description="Описание проблемы от студента (обязательно)",
    )
    reported_by: str | None = Field(
        default=None,
        max_length=128,
        description="Внешний id студента-инициатора (LTI sub)",
    )


class UnfreezeIn(BaseModel):
    new_ttl_seconds: int | None = Field(
        default=None,
        gt=0,
        le=7 * 24 * 3600,
        description="Переопределение TTL после разморозки по умолчанию текущий default_ttl",
    )
    requested_by: str | None = Field(default=None, max_length=128)


class ExtendIn(BaseModel):
    new_ttl_seconds: int = Field(
        ...,
        gt=0,
        le=7 * 24 * 3600,
        description="Новый TTL в секундах от текущего момента",
    )
    requested_by: str | None = Field(default=None, max_length=128)

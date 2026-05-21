from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.models.check_run import (
    CheckResult,
    CheckResultStatus,
    CheckRun,
    CheckRunStatus,
)


class CheckScheduleIn(BaseModel):
    template_name: str = Field(
        ...,
        min_length=1,
        max_length=128,
        description="Имя YAML-шаблона из CHECK_TEMPLATES_DIR без расширения",
    )
    requested_by: str | None = Field(default=None, max_length=128)


class CheckResultOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    position: int
    name: str
    kind: str
    status: CheckResultStatus
    message: str | None
    stdout: str | None
    stderr: str | None
    exit_code: int | None
    duration_ms: int | None
    spec: dict

    @classmethod
    def from_orm_result(cls, r: CheckResult) -> "CheckResultOut":
        return cls.model_validate(r)


class CheckRunOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    stand_id: UUID
    template_name: str
    template_version: str | None
    requested_by: str | None
    status: CheckRunStatus
    summary: str | None
    task_id: str | None
    started_at: datetime | None
    finished_at: datetime | None
    total: int
    passed: int
    failed: int
    errored: int
    created_at: datetime
    updated_at: datetime
    results: list[CheckResultOut] = Field(default_factory=list)

    @classmethod
    def from_orm_run(cls, r: CheckRun, *, with_results: bool = True) -> "CheckRunOut":
        data = cls.model_validate(r)
        if not with_results:
            data = data.model_copy(update={"results": []})
        return data


class CheckScheduleAcceptedOut(BaseModel):
    run: CheckRunOut
    task_id: str

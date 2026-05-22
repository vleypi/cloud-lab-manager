from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.models.stand import Stand, StandStatus


class StandLaunchIn(BaseModel):
    owner_external_id: str = Field(
        ...,
        min_length=1,
        max_length=128,
        description="Стабильный идентификатор студента например LTI sub",
    )
    owner_display_name: str | None = Field(default=None, max_length=256)
    image_id: str = Field(..., min_length=1, max_length=64, description="UUID образа Glance")
    flavor_id: str = Field(..., min_length=1, max_length=64, description="UUID flavor Nova")
    course_code: str | None = Field(
        default=None,
        max_length=64,
        description="Идентификатор курса равен имени домена КИ",
    )
    lab_code: str | None = Field(default=None, max_length=64)
    attach_floating_ip: bool = True


class PoolProjectOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    ki_project_id: str
    ki_project_name: str
    ki_domain_name: str


class StandOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    owner_external_id: str
    owner_display_name: str | None
    status: StandStatus
    status_reason: str | None
    course_code: str | None
    lab_code: str | None
    image_id: str
    flavor_id: str
    pool_project: PoolProjectOut
    ki_server_id: str | None
    ki_floating_ip: str | None
    ssh_public_key_fingerprint: str | None
    deployed_at: datetime | None
    expires_at: datetime | None
    destroyed_at: datetime | None
    frozen_at: datetime | None
    frozen_reason: str | None
    task_id: str | None
    attempt: int
    created_at: datetime
    updated_at: datetime

    incident_reported: bool = False
    incident_reported_by: str | None = None
    incident_reported_at: str | None = None
    incident_description: str | None = None

    @classmethod
    def from_orm_stand(cls, stand: Stand) -> "StandOut":
        base = cls.model_validate(stand)
        extra = stand.extra or {}
        return base.model_copy(
            update={
                "incident_reported": bool(extra.get("incident_reported")),
                "incident_reported_by": extra.get("incident_reported_by"),
                "incident_reported_at": extra.get("incident_reported_at"),
                "incident_description": extra.get("incident_description"),
            }
        )


class StandLaunchAcceptedOut(BaseModel):
    stand: StandOut
    task_id: str
    credentials_url: str = Field(
        ..., description="Одноразовая ссылка на выдачу SSH-приватника"
    )


class StandCredentialsOut(BaseModel):
    keypair_name: str
    fingerprint: str
    ssh_public_key: str
    ssh_private_key: str
    console_password: str | None = None


class ConsoleTokenOut(BaseModel):
    token: str
    expires_in: int
    ws_url: str


class ConsoleUrlOut(BaseModel):
    url: str
    type: str = "novnc"
    rewrite: bool = False


class StandActionAcceptedOut(BaseModel):
    stand: StandOut
    task_id: str | None = None

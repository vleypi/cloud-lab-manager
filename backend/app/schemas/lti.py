from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.models.lti import CourseMapping, LtiPlatform, PendingLtiBinding


class LtiPlatformIn(BaseModel):
    name: str = Field(..., min_length=1, max_length=128)
    issuer: str = Field(..., min_length=1, max_length=512)
    client_id: str = Field(..., min_length=1, max_length=256)
    deployment_ids: list[str] = Field(default_factory=list)
    auth_login_url: str = Field(..., min_length=1, max_length=512)
    auth_token_url: str = Field(..., min_length=1, max_length=512)
    jwks_url: str = Field(..., min_length=1, max_length=512)
    enabled: bool = True


class LtiPlatformOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    issuer: str
    client_id: str
    deployment_ids: list[str]
    auth_login_url: str
    auth_token_url: str
    jwks_url: str
    enabled: bool

    @classmethod
    def from_orm_platform(cls, p: LtiPlatform) -> "LtiPlatformOut":
        return cls(
            id=p.id,
            name=p.name,
            issuer=p.issuer,
            client_id=p.client_id,
            deployment_ids=sorted(p.allowed_deployments()),
            auth_login_url=p.auth_login_url,
            auth_token_url=p.auth_token_url,
            jwks_url=p.jwks_url,
            enabled=p.enabled,
        )


class CourseMappingIn(BaseModel):
    lti_context_id: str = Field(..., min_length=1, max_length=256)
    resource_link_id: str | None = Field(default=None, max_length=256)
    course_code: str = Field(..., min_length=1, max_length=64)
    ki_domain_name: str = Field(..., min_length=1, max_length=128)
    lab_code: str = Field(..., min_length=1, max_length=64)
    image_id: str = Field(..., min_length=1, max_length=64)
    flavor_id: str = Field(..., min_length=1, max_length=64)
    inspector_template: str | None = Field(default=None, max_length=128)
    title: str | None = Field(default=None, max_length=256)
    description: str | None = Field(default=None)
    default_ttl_seconds: int | None = Field(default=None, ge=60, le=86400 * 7)


class CourseMappingOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    lti_context_id: str
    resource_link_id: str | None
    course_code: str
    ki_domain_name: str
    lab_code: str
    image_id: str
    flavor_id: str
    inspector_template: str | None
    title: str | None
    description: str | None
    default_ttl_seconds: int | None

    @classmethod
    def from_orm_mapping(cls, m: CourseMapping) -> "CourseMappingOut":
        return cls.model_validate(m)


class LabLaunchIn(BaseModel):
    owner_external_id: str = Field(..., min_length=1, max_length=128)
    owner_display_name: str | None = Field(default=None, max_length=256)
    attach_floating_ip: bool = True


class MoodleRestLaunchIn(BaseModel):
    user_id: str = Field(..., min_length=1, max_length=128)
    user_display_name: str | None = Field(default=None, max_length=256)
    lti_context_id: str = Field(..., min_length=1, max_length=256)
    resource_link_id: str | None = Field(default=None, max_length=256)
    # опциональные человеческие заголовки для UI ожидающих привязок
    context_title: str | None = Field(default=None, max_length=512)
    resource_link_title: str | None = Field(default=None, max_length=512)


class MoodleRestLaunchOut(BaseModel):
    stand_id: UUID
    task_id: str
    redirect_url: str


class PendingLtiBindingOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    lti_context_id: str
    resource_link_id: str | None
    context_title: str | None
    resource_link_title: str | None
    last_user_external_id: str | None
    last_user_display_name: str | None
    seen_count: int
    last_seen_at: datetime
    created_at: datetime

    @classmethod
    def from_orm(cls, p: PendingLtiBinding) -> "PendingLtiBindingOut":
        return cls.model_validate(p)

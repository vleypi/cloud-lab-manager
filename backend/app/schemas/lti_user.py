from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from app.models.lti_user import LtiUser


class LtiUserOut(BaseModel):
    id: UUID
    platform_id: UUID
    subject: str
    email: str | None = None
    name: str | None = None
    owner_external_id: str
    last_context_id: str | None = None
    last_context_title: str | None = None
    last_resource_link_id: str | None = None
    login_count: int
    last_seen_at: datetime
    created_at: datetime

    @classmethod
    def from_orm_row(cls, row: LtiUser) -> "LtiUserOut":
        return cls(
            id=row.id,
            platform_id=row.platform_id,
            subject=row.subject,
            email=row.email,
            name=row.name,
            owner_external_id=row.owner_external_id,
            last_context_id=row.last_context_id,
            last_context_title=row.last_context_title,
            last_resource_link_id=row.last_resource_link_id,
            login_count=row.login_count,
            last_seen_at=row.last_seen_at,
            created_at=row.created_at,
        )


class LtiUserListOut(BaseModel):
    items: list[LtiUserOut] = Field(default_factory=list)
    total: int = 0
    limit: int = 100
    offset: int = 0

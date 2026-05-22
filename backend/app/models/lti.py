import uuid
from datetime import datetime

from sqlalchemy import (
    DateTime,
    Index,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin


class LtiPlatform(Base, TimestampMixin):
    __tablename__ = "lti_platforms"
    __table_args__ = (UniqueConstraint("issuer", "client_id", name="uq_lti_platforms_iss_client"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    name: Mapped[str] = mapped_column(String(128), nullable=False)
    issuer: Mapped[str] = mapped_column(String(512), nullable=False)
    client_id: Mapped[str] = mapped_column(String(256), nullable=False)
    deployment_ids: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        default="",
        comment="Comma-separated allowed deployment_id values.",
    )

    auth_login_url: Mapped[str] = mapped_column(String(512), nullable=False)
    auth_token_url: Mapped[str] = mapped_column(String(512), nullable=False)
    jwks_url: Mapped[str] = mapped_column(String(512), nullable=False)

    enabled: Mapped[bool] = mapped_column(default=True, nullable=False)

    def allowed_deployments(self) -> set[str]:
        if not self.deployment_ids:
            return set()
        return {d.strip() for d in self.deployment_ids.split(",") if d.strip()}


class CourseMapping(Base, TimestampMixin):
    __tablename__ = "course_mappings"
    __table_args__ = (
        UniqueConstraint(
            "lti_context_id",
            "resource_link_id",
            name="uq_course_mappings_context_link",
        ),
        Index("ix_course_mappings_context", "lti_context_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    lti_context_id: Mapped[str] = mapped_column(String(256), nullable=False)
    resource_link_id: Mapped[str | None] = mapped_column(String(256), nullable=True)

    course_code: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        comment="Human-readable code, e.g. course-cloud.",
    )
    ki_domain_name: Mapped[str] = mapped_column(String(128), nullable=False)
    lab_code: Mapped[str] = mapped_column(String(64), nullable=False)
    image_id: Mapped[str] = mapped_column(String(64), nullable=False)
    flavor_id: Mapped[str] = mapped_column(String(64), nullable=False)

    inspector_template: Mapped[str | None] = mapped_column(String(128), nullable=True)

    title: Mapped[str | None] = mapped_column(String(256), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    default_ttl_seconds: Mapped[int | None] = mapped_column(nullable=True)


class PendingLtiBinding(Base, TimestampMixin):
    # запросы от Moodle с context_id/resource_link_id, для которых ещё нет CourseMapping.
    # препод видит этот список в админке и одним кликом создаёт маппинг без копипаста id
    __tablename__ = "pending_lti_bindings"
    __table_args__ = (
        UniqueConstraint(
            "lti_context_id",
            "resource_link_id",
            name="uq_pending_lti_bindings_context_link",
        ),
        Index("ix_pending_lti_bindings_last_seen", "last_seen_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    lti_context_id: Mapped[str] = mapped_column(String(256), nullable=False)
    resource_link_id: Mapped[str | None] = mapped_column(String(256), nullable=True)

    # человеческие заголовки из LTI payload (Moodle присылает context.title / resource_link.title)
    context_title: Mapped[str | None] = mapped_column(String(512), nullable=True)
    resource_link_title: Mapped[str | None] = mapped_column(String(512), nullable=True)

    # последний пользователь и счётчик попыток — препод видит «N студентов уже ждут»
    last_user_external_id: Mapped[str | None] = mapped_column(String(256), nullable=True)
    last_user_display_name: Mapped[str | None] = mapped_column(String(256), nullable=True)
    seen_count: Mapped[int] = mapped_column(default=1, nullable=False)
    last_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

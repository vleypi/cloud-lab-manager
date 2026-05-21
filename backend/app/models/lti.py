import uuid

from sqlalchemy import (
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
    __table_args__ = (
        UniqueConstraint("issuer", "client_id", name="uq_lti_platforms_iss_client"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

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

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

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

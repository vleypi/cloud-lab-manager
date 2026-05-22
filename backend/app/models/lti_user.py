import uuid
from datetime import datetime

from sqlalchemy import (
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin


class LtiUser(Base, TimestampMixin):
    __tablename__ = "lti_users"
    __table_args__ = (
        UniqueConstraint("platform_id", "subject", name="uq_lti_users_platform_subject"),
        Index("ix_lti_users_last_seen", "last_seen_at"),
        Index("ix_lti_users_email", "email"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    platform_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("lti_platforms.id", ondelete="CASCADE"),
        nullable=False,
    )
    subject: Mapped[str] = mapped_column(String(256), nullable=False)
    email: Mapped[str | None] = mapped_column(String(256), nullable=True)
    name: Mapped[str | None] = mapped_column(String(256), nullable=True)

    owner_external_id: Mapped[str] = mapped_column(String(512), nullable=False)

    last_context_id: Mapped[str | None] = mapped_column(String(256), nullable=True)
    last_context_title: Mapped[str | None] = mapped_column(String(512), nullable=True)
    last_resource_link_id: Mapped[str | None] = mapped_column(String(256), nullable=True)

    login_count: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    last_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

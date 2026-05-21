import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    DateTime,
    Enum,
    ForeignKey,
    Index,
    String,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin
from app.models.project import PoolProject


class StandStatus(str, enum.Enum):
    ALLOCATING = "allocating"
    DEPLOYING = "deploying"
    READY = "ready"
    FAILED = "failed"
    FROZEN = "frozen"
    CLEANING = "cleaning"
    DESTROYED = "destroyed"


class Stand(Base, TimestampMixin):
    __tablename__ = "stands"
    __table_args__ = (
        Index("ix_stands_owner_status", "owner_external_id", "status"),
        Index("ix_stands_status", "status"),
        UniqueConstraint("ki_server_id", name="uq_stands_ki_server_id"),
        # один студент держит максимум один активный стенд
        Index(
            "uq_stands_owner_active",
            "owner_external_id",
            unique=True,
            postgresql_where=text(
                "status IN ('allocating', 'deploying', 'ready', 'frozen', 'cleaning')"
            ),
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    owner_external_id: Mapped[str] = mapped_column(String(128), nullable=False)
    owner_display_name: Mapped[str | None] = mapped_column(String(256), nullable=True)

    pool_project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("pool_projects.id", ondelete="RESTRICT"),
        nullable=False,
    )
    pool_project: Mapped[PoolProject] = relationship(lazy="joined")

    course_code: Mapped[str | None] = mapped_column(String(64), nullable=True)
    lab_code: Mapped[str | None] = mapped_column(String(64), nullable=True)

    image_id: Mapped[str] = mapped_column(String(64), nullable=False)
    flavor_id: Mapped[str] = mapped_column(String(64), nullable=False)

    ki_server_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    ki_keypair_name: Mapped[str | None] = mapped_column(String(128), nullable=True)
    ki_floating_ip: Mapped[str | None] = mapped_column(String(64), nullable=True)

    ssh_public_key_fingerprint: Mapped[str | None] = mapped_column(String(128), nullable=True)

    status: Mapped[StandStatus] = mapped_column(
        Enum(
            StandStatus,
            name="stand_status",
            values_callable=lambda enum_cls: [e.value for e in enum_cls],
        ),
        nullable=False,
        default=StandStatus.ALLOCATING,
    )
    status_reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    deployed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    destroyed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # заморозка для разбора инцидента преподавателем
    frozen_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    frozen_reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    # id текущей Celery-задачи провижена или удаления для UI
    task_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    attempt: Mapped[int] = mapped_column(default=0, nullable=False)

    extra: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)

    def __repr__(self) -> str:  # pragma: no cover
        return f"<Stand {self.id} owner={self.owner_external_id} status={self.status.value}>"

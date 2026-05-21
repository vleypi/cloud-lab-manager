import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    DateTime,
    Enum,
    Index,
    String,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin


class ProjectStatus(str, enum.Enum):
    FREE = "free"
    ALLOCATED = "allocated"
    CLEANING = "cleaning"
    DISABLED = "disabled"


class PoolProject(Base, TimestampMixin):
    __tablename__ = "pool_projects"
    __table_args__ = (
        UniqueConstraint("ki_project_id", name="uq_pool_projects_ki_project_id"),
        Index("ix_pool_projects_status", "status"),
        Index("ix_pool_projects_domain", "ki_domain_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    ki_project_id: Mapped[str] = mapped_column(String(64), nullable=False)
    ki_project_name: Mapped[str] = mapped_column(String(128), nullable=False)
    ki_domain_id: Mapped[str] = mapped_column(String(64), nullable=False)
    ki_domain_name: Mapped[str] = mapped_column(String(128), nullable=False)

    ki_network_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    ki_router_id: Mapped[str | None] = mapped_column(String(64), nullable=True)

    status: Mapped[ProjectStatus] = mapped_column(
        Enum(
            ProjectStatus,
            name="project_status",
            values_callable=lambda enum_cls: [e.value for e in enum_cls],
        ),
        nullable=False,
        default=ProjectStatus.FREE,
    )
    last_released_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    def __repr__(self) -> str: 
        return (
            f"<PoolProject {self.ki_project_name} "
            f"({self.ki_domain_name}) status={self.status.value}>"
        )

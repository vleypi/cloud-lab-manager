import uuid

from sqlalchemy import Float, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin


class CapacityRejection(Base, TimestampMixin):
    __tablename__ = "capacity_rejections"
    __table_args__ = (
        Index("ix_capacity_rejections_created_at", "created_at"),
        Index("ix_capacity_rejections_owner", "owner_external_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    owner_external_id: Mapped[str] = mapped_column(String(128), nullable=False)
    owner_display_name: Mapped[str | None] = mapped_column(String(256), nullable=True)
    course_code: Mapped[str | None] = mapped_column(String(64), nullable=True)
    lab_code: Mapped[str | None] = mapped_column(String(64), nullable=True)

    image_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    flavor_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    flavor_vcpus: Mapped[int | None] = mapped_column(Integer, nullable=True)
    flavor_ram_mb: Mapped[int | None] = mapped_column(Integer, nullable=True)
    flavor_disk_gb: Mapped[int | None] = mapped_column(Integer, nullable=True)

    threshold_percent: Mapped[float] = mapped_column(Float, nullable=False)
    current_max_percent: Mapped[float] = mapped_column(Float, nullable=False)
    projected_max_percent: Mapped[float | None] = mapped_column(Float, nullable=True)

    vcpus_used: Mapped[float | None] = mapped_column(Float, nullable=True)
    vcpus_total: Mapped[float | None] = mapped_column(Float, nullable=True)
    memory_mb_used: Mapped[float | None] = mapped_column(Float, nullable=True)
    memory_mb_total: Mapped[float | None] = mapped_column(Float, nullable=True)
    local_gb_used: Mapped[float | None] = mapped_column(Float, nullable=True)
    local_gb_total: Mapped[float | None] = mapped_column(Float, nullable=True)
    running_vms: Mapped[int | None] = mapped_column(Integer, nullable=True)

    reason: Mapped[str] = mapped_column(Text, nullable=False)
    raw_details: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

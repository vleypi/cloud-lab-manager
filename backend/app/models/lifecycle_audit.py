import uuid

from sqlalchemy import Index, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin


class LifecycleSettingChange(Base, TimestampMixin):
    __tablename__ = "lifecycle_setting_changes"
    __table_args__ = (
        Index("ix_lifecycle_setting_changes_created_at", "created_at"),
        Index("ix_lifecycle_setting_changes_key", "key"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    key: Mapped[str] = mapped_column(String(64), nullable=False)
    old_value: Mapped[str | None] = mapped_column(Text, nullable=True)
    new_value: Mapped[str] = mapped_column(Text, nullable=False)
    updated_by: Mapped[str | None] = mapped_column(String(256), nullable=True)

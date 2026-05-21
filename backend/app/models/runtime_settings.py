from sqlalchemy import String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin


class RuntimeSetting(Base, TimestampMixin):
    __tablename__ = "runtime_settings"

    key: Mapped[str] = mapped_column(String(64), primary_key=True)
    value: Mapped[str] = mapped_column(Text, nullable=False)
    updated_by: Mapped[str | None] = mapped_column(String(128), nullable=True)


KEY_DEFAULT_TTL = "stand_default_ttl_seconds"
KEY_FREEZE_TTL = "stand_freeze_ttl_seconds"
KEY_CAPACITY_THRESHOLD = "capacity_threshold_percent"

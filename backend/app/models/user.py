import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    external_id: Mapped[str] = mapped_column(
        String(256),
        nullable=False,
        unique=True,
    )
    email: Mapped[str | None] = mapped_column(String(256), nullable=True, unique=True)
    display_name: Mapped[str] = mapped_column(String(256), nullable=False)

    is_super_admin: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )

    password_hash: Mapped[str | None] = mapped_column(String(256), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    def __repr__(self) -> str:
        return (
            f"<User {self.id} external_id={self.external_id!r} "
            f"super_admin={self.is_super_admin}>"
        )

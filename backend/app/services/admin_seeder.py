import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.user import User

logger = structlog.get_logger(__name__)

DEFAULT_ADMIN_DISPLAY_NAME = "System Administrator"


async def seed_super_admin(session: AsyncSession) -> User | None:
    settings = get_settings()
    email = settings.super_admin_email.strip().lower()
    password_hash = settings.super_admin_password_hash.get_secret_value().strip()

    if not email or not password_hash:
        logger.info("super_admin_seed_skipped", reason="env_vars_empty")
        return None

    external_id = f"admin:{email}"
    display_name = settings.super_admin_display_name or DEFAULT_ADMIN_DISPLAY_NAME

    user = await session.scalar(
        select(User).where(User.external_id == external_id)
    )

    if user is None:
        user = User(
            external_id=external_id,
            email=email,
            display_name=display_name,
            is_super_admin=True,
            password_hash=password_hash,
        )
        session.add(user)
        await session.commit()
        await session.refresh(user)
        logger.info("super_admin_created", email=email, user_id=str(user.id))
        return user

    desired_fields = {
        "email": email,
        "password_hash": password_hash,
        "is_super_admin": True,
        "display_name": settings.super_admin_display_name or user.display_name,
    }
    changed = False
    for field, new_value in desired_fields.items():
        if getattr(user, field) != new_value:
            setattr(user, field, new_value)
            changed = True

    if changed:
        await session.commit()
        await session.refresh(user)
        logger.info("super_admin_updated", email=email, user_id=str(user.id))

    return user

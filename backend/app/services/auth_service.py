from datetime import UTC, datetime
from uuid import UUID

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import OrchestratorError
from app.core.security import verify_password
from app.models.user import User

logger = structlog.get_logger(__name__)


class InvalidCredentialsError(OrchestratorError):
    http_status = 401
    code = "invalid_credentials"


class AccountNotFoundError(OrchestratorError):
    http_status = 401
    code = "account_not_found"


class AuthService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_by_id(self, user_id: UUID) -> User | None:
        return await self._session.get(User, user_id)

    async def get_by_external_id(self, external_id: str) -> User | None:
        result = await self._session.execute(select(User).where(User.external_id == external_id))
        return result.scalar_one_or_none()

    async def get_by_email(self, email: str) -> User | None:
        result = await self._session.execute(select(User).where(User.email == email.lower()))
        return result.scalar_one_or_none()

    async def admin_login(self, *, email: str, password: str) -> User:
        user = await self.get_by_email(email)
        if user is None or not user.is_super_admin or not user.password_hash:
            raise InvalidCredentialsError("Invalid email or password")
        if not verify_password(password, user.password_hash):
            raise InvalidCredentialsError("Invalid email or password")

        await self._touch_last_login(user)
        logger.info("admin_login_success", user_id=str(user.id), email=email)
        return user

    async def dev_login(
        self,
        *,
        external_id: str,
        display_name: str | None,
        is_super_admin: bool,
    ) -> User:
        user = await self.get_by_external_id(external_id)
        if user is None:
            user = User(
                external_id=external_id,
                display_name=display_name or external_id,
                is_super_admin=is_super_admin,
            )
            self._session.add(user)
        else:
            if display_name:
                user.display_name = display_name
            user.is_super_admin = is_super_admin

        await self._touch_last_login(user)
        logger.info(
            "dev_login_success",
            user_id=str(user.id),
            external_id=external_id,
            is_super_admin=is_super_admin,
        )
        return user

    async def _touch_last_login(self, user: User) -> None:
        user.last_login_at = datetime.now(UTC)
        await self._session.commit()
        await self._session.refresh(user)

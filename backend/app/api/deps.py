from collections.abc import AsyncIterator
from functools import lru_cache
from uuid import UUID

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.core.security import TokenError, verify_access_token
from app.db.session import get_session
from app.models.user import User
from app.providers import CloudProvider, get_cloud_provider
from app.services.auth_service import AuthService
from app.services.capacity_checker import CapacityChecker
from app.services.credentials_store import CredentialsStore
from app.services.inspector_service import InspectorService
from app.services.lifecycle_service import LifecycleService
from app.services.lifecycle_settings import LifecycleSettings
from app.services.lti_service import LtiService
from app.services.pool_manager import PoolManager
from app.services.stand_service import StandService


async def db_session() -> AsyncIterator[AsyncSession]:
    async for session in get_session():
        yield session


def cloud_provider() -> CloudProvider:
    return get_cloud_provider()


@lru_cache(maxsize=1)
def capacity_checker() -> CapacityChecker:
    return CapacityChecker(get_cloud_provider())


@lru_cache(maxsize=1)
def credentials_store() -> CredentialsStore:
    return CredentialsStore()


def pool_manager(session: AsyncSession = Depends(db_session)) -> PoolManager:
    return PoolManager(session)


def stand_service(
    session: AsyncSession = Depends(db_session),
    provider: CloudProvider = Depends(cloud_provider),
    capacity: CapacityChecker = Depends(capacity_checker),
) -> StandService:
    return StandService(session, provider=provider, capacity=capacity)


def lifecycle_service(session: AsyncSession = Depends(db_session)) -> LifecycleService:
    return LifecycleService(session)


def lifecycle_settings(session: AsyncSession = Depends(db_session)) -> LifecycleSettings:
    return LifecycleSettings(session)


def inspector_service(session: AsyncSession = Depends(db_session)) -> InspectorService:
    return InspectorService(session)


def lti_service(
    session: AsyncSession = Depends(db_session),
    provider: CloudProvider = Depends(cloud_provider),
    capacity: CapacityChecker = Depends(capacity_checker),
) -> LtiService:
    stand_svc = StandService(session, provider=provider, capacity=capacity)
    return LtiService(session, stand_service=stand_svc)


def auth_service(session: AsyncSession = Depends(db_session)) -> AuthService:
    return AuthService(session)


async def current_user(
    request: Request,
    auth: AuthService = Depends(auth_service),
) -> User:
    settings = get_settings()
    token = request.cookies.get(settings.cookie_access_name)
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="not_authenticated")
    try:
        payload = verify_access_token(token)
    except TokenError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid_token"
        ) from exc

    try:
        user_id = UUID(payload.subject)
    except (ValueError, TypeError) as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid_token"
        ) from exc

    user = await auth.get_by_id(user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="user_gone")
    return user


async def require_super_admin(user: User = Depends(current_user)) -> User:
    if not user.is_super_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="super_admin_required")
    return user

from collections.abc import Callable
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status

from app.api.auth_cookies import clear_session, issue_session, rotate_access
from app.api.deps import auth_service, current_user
from app.config import get_settings
from app.core.security import TokenError, verify_access_token, verify_refresh_token
from app.models.user import User
from app.schemas.auth import (
    AdminLoginIn,
    DevLoginIn,
    IsAuthenticatedOut,
    MeOut,
    UserOut,
)
from app.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["auth"])


async def _user_from_token(
    token: str, verifier: Callable, service: AuthService
) -> User | None:
    try:
        payload = verifier(token)
        return await service.get_by_id(UUID(payload.subject))
    except (TokenError, ValueError):
        return None


@router.post("/admin/login", response_model=MeOut)
async def admin_login(
    payload: AdminLoginIn,
    response: Response,
    service: AuthService = Depends(auth_service),
) -> MeOut:
    user = await service.admin_login(email=payload.email, password=payload.password)
    issue_session(
        response, user_id=str(user.id), is_super_admin=user.is_super_admin
    )
    return MeOut(user=UserOut.model_validate(user))


@router.post("/dev/login", response_model=MeOut)
async def dev_login(
    payload: DevLoginIn,
    response: Response,
    service: AuthService = Depends(auth_service),
) -> MeOut:
    settings = get_settings()
    if settings.app_env == "production":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)

    user = await service.dev_login(
        external_id=payload.external_id,
        display_name=payload.display_name,
        is_super_admin=payload.is_super_admin,
    )
    issue_session(
        response, user_id=str(user.id), is_super_admin=user.is_super_admin
    )
    return MeOut(user=UserOut.model_validate(user))


@router.get("/me", response_model=MeOut)
async def me(user: User = Depends(current_user)) -> MeOut:
    return MeOut(user=UserOut.model_validate(user))


@router.get("/is-authenticated", response_model=IsAuthenticatedOut)
async def is_authenticated(
    request: Request,
    response: Response,
    service: AuthService = Depends(auth_service),
) -> IsAuthenticatedOut:
    settings = get_settings()

    access = request.cookies.get(settings.cookie_access_name)
    if access:
        try:
            payload = verify_access_token(access)
            user = await service.get_by_id(UUID(payload.subject))
            if user is not None:
                return IsAuthenticatedOut(
                    authenticated=True,
                    is_super_admin=user.is_super_admin,
                    user_id=user.id,
                )
        except (TokenError, ValueError):
            pass

    refresh = request.cookies.get(settings.cookie_refresh_name)
    if refresh:
        try:
            payload = verify_refresh_token(refresh)
            user = await service.get_by_id(UUID(payload.subject))
            if user is not None:
                rotate_access(
                    response,
                    user_id=str(user.id),
                    is_super_admin=user.is_super_admin,
                )
                return IsAuthenticatedOut(
                    authenticated=True,
                    is_super_admin=user.is_super_admin,
                    user_id=user.id,
                )
        except (TokenError, ValueError):
            pass

    clear_session(response)
    return IsAuthenticatedOut(authenticated=False)


@router.post("/refresh", response_model=MeOut)
async def refresh(
    request: Request,
    response: Response,
    service: AuthService = Depends(auth_service),
) -> MeOut:
    settings = get_settings()
    refresh_token = request.cookies.get(settings.cookie_refresh_name)
    if not refresh_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="missing_refresh"
        )
    try:
        payload = verify_refresh_token(refresh_token)
    except TokenError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid_refresh"
        ) from exc

    user = await service.get_by_id(UUID(payload.subject))
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="user_gone"
        )

    issue_session(response, user_id=str(user.id), is_super_admin=user.is_super_admin)
    return MeOut(user=UserOut.model_validate(user))


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(response: Response) -> Response:
    clear_session(response)
    response.status_code = status.HTTP_204_NO_CONTENT
    return response

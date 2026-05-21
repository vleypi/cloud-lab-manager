from urllib.parse import urljoin

from fastapi import APIRouter, Depends, Form, HTTPException, Path, Query, Request, status
from fastapi.responses import RedirectResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import db_session, lti_service, require_super_admin, stand_service
from app.config import get_settings
from app.lti.jwks import tool_jwks
from app.models.lti import CourseMapping, LtiPlatform
from app.models.user import User
from app.schemas.lti import (
    CourseMappingIn,
    CourseMappingOut,
    LabLaunchIn,
    LtiPlatformIn,
    LtiPlatformOut,
)
from app.schemas.stand import StandLaunchAcceptedOut, StandOut
from app.services.lti_service import LtiService
from app.services.stand_service import StandLaunchRequest, StandService

router = APIRouter(prefix="/lti", tags=["lti"])


@router.get("/login")
@router.post("/login")
async def lti_login(
    request: Request,
    iss: str | None = Query(default=None),
    login_hint: str | None = Query(default=None),
    target_link_uri: str | None = Query(default=None),
    lti_message_hint: str | None = Query(default=None),
    client_id: str | None = Query(default=None),
    service: LtiService = Depends(lti_service),
) -> RedirectResponse:
    settings = get_settings()
    redirect_uri = urljoin(settings.lti_tool_base_url.rstrip("/") + "/", "api/v1/lti/launch")

    if request.method == "POST":
        form = await request.form()
        iss = str(form.get("iss") or iss or "")
        login_hint = str(form.get("login_hint") or login_hint or "")
        target_link_uri = str(form.get("target_link_uri") or target_link_uri or "")
        lti_message_hint = (
            str(form.get("lti_message_hint")) if form.get("lti_message_hint") else lti_message_hint
        )
        client_id = str(form.get("client_id")) if form.get("client_id") else client_id

    if not iss or not login_hint or not target_link_uri:
        raise HTTPException(
            status_code=400,
            detail={
                "error": "missing_oidc_params",
                "iss": iss,
                "login_hint": login_hint,
                "target_link_uri": target_link_uri,
            },
        )

    outcome = await service.begin_login(
        iss=iss,
        client_id=client_id,
        login_hint=login_hint,
        target_link_uri=target_link_uri,
        lti_message_hint=lti_message_hint,
        redirect_uri=redirect_uri,
    )
    return RedirectResponse(outcome.authorization_url, status_code=status.HTTP_302_FOUND)


async def lti_launch(
    state: str = Form(...),
    id_token: str = Form(...),
    service: LtiService = Depends(lti_service),
) -> RedirectResponse:
    outcome = await service.finish_launch(state=state, id_token=id_token)
    return RedirectResponse(outcome.redirect_url, status_code=status.HTTP_302_FOUND)


@router.get("/jwks.json")
async def jwks() -> dict:
    return tool_jwks()


@router.get("/config.json")
async def tool_config() -> dict:
    settings = get_settings()
    base = settings.lti_tool_base_url.rstrip("/")
    return {
        "title": "Cloud-Lab Manager",
        "description": "Secure orchestration gateway for KI lab stands",
        "oidc_initiation_url": f"{base}/api/v1/lti/login",
        "target_link_uri": f"{base}/api/v1/lti/launch",
        "public_jwk_url": f"{base}/api/v1/lti/jwks.json",
        "scopes": [],
        "extensions": [],
    }


@router.post(
    "/platforms",
    response_model=LtiPlatformOut,
    status_code=status.HTTP_201_CREATED,
)
async def register_platform(
    payload: LtiPlatformIn,
    session: AsyncSession = Depends(db_session),
) -> LtiPlatformOut:
    platform = LtiPlatform(
        name=payload.name,
        issuer=payload.issuer,
        client_id=payload.client_id,
        deployment_ids=",".join(payload.deployment_ids),
        auth_login_url=payload.auth_login_url,
        auth_token_url=payload.auth_token_url,
        jwks_url=payload.jwks_url,
        enabled=payload.enabled,
    )
    session.add(platform)
    await session.commit()
    await session.refresh(platform)
    return LtiPlatformOut.from_orm_platform(platform)


@router.get("/platforms", response_model=list[LtiPlatformOut])
async def list_platforms(
    session: AsyncSession = Depends(db_session),
) -> list[LtiPlatformOut]:
    platforms = await session.scalars(
        select(LtiPlatform).order_by(LtiPlatform.created_at.desc())
    )
    return [LtiPlatformOut.from_orm_platform(p) for p in platforms.all()]


@router.post(
    "/mappings",
    response_model=CourseMappingOut,
    status_code=status.HTTP_201_CREATED,
)
async def upsert_mapping(
    payload: CourseMappingIn,
    session: AsyncSession = Depends(db_session),
) -> CourseMappingOut:
    mapping = await session.scalar(
        select(CourseMapping)
        .where(CourseMapping.lti_context_id == payload.lti_context_id)
        .where(CourseMapping.resource_link_id == payload.resource_link_id)
    )
    if mapping is None:
        mapping = CourseMapping(**payload.model_dump())
        session.add(mapping)
    else:
        for k, v in payload.model_dump().items():
            setattr(mapping, k, v)
    await session.commit()
    await session.refresh(mapping)
    return CourseMappingOut.from_orm_mapping(mapping)


@router.get("/mappings", response_model=list[CourseMappingOut])
async def list_mappings(
    session: AsyncSession = Depends(db_session),
    lti_context_id: str | None = Query(default=None),
) -> list[CourseMappingOut]:
    stmt = select(CourseMapping).order_by(CourseMapping.created_at.desc())
    if lti_context_id:
        stmt = stmt.where(CourseMapping.lti_context_id == lti_context_id)
    mappings = await session.scalars(stmt)
    return [CourseMappingOut.from_orm_mapping(m) for m in mappings.all()]


@router.delete("/mappings/{mapping_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_mapping(
    mapping_id: str = Path(...),
    session: AsyncSession = Depends(db_session),
) -> None:
    mapping = await session.get(CourseMapping, mapping_id)
    if mapping:
        await session.delete(mapping)
        await session.commit()


@router.post(
    "/mappings/{mapping_id}/launch",
    response_model=StandLaunchAcceptedOut,
    status_code=status.HTTP_202_ACCEPTED,
)
async def launch_lab_for_owner(
    payload: LabLaunchIn,
    request: Request,
    mapping_id: str = Path(...),
    session: AsyncSession = Depends(db_session),
    service: StandService = Depends(stand_service),
    _admin: User = Depends(require_super_admin),
) -> StandLaunchAcceptedOut:
    mapping = await session.get(CourseMapping, mapping_id)
    if mapping is None:
        raise HTTPException(status_code=404, detail="mapping_not_found")

    accepted = await service.launch(
        StandLaunchRequest(
            owner_external_id=payload.owner_external_id,
            owner_display_name=payload.owner_display_name,
            image_id=mapping.image_id,
            flavor_id=mapping.flavor_id,
            course_code=mapping.ki_domain_name,
            lab_code=mapping.lab_code,
            attach_floating_ip=payload.attach_floating_ip,
        )
    )
    creds_url = str(request.url_for("get_stand_credentials", stand_id=accepted.stand.id))
    return StandLaunchAcceptedOut(
        stand=StandOut.from_orm_stand(accepted.stand),
        task_id=accepted.task_id,
        credentials_url=creds_url,
    )

from dataclasses import dataclass
from urllib.parse import urlencode

import structlog
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.core.exceptions import LtiStateExpiredError, OrchestratorError
from app.core.state_machine import is_active
from app.lti.state_store import (
    LaunchState,
    LaunchStateStore,
    generate_nonce,
    generate_state,
)
from app.lti.validator import LaunchClaims, validate_id_token
from app.models.lti import CourseMapping, LtiPlatform
from app.models.stand import Stand
from app.services.capacity_checker import CapacityChecker
from app.services.lti_user_service import upsert_lti_user
from app.services.pending_lti_binding_service import record_unmapped_launch
from app.services.stand_service import (
    StandLaunchRequest,
    StandService,
)

logger = structlog.get_logger(__name__)


class LtiPlatformNotRegisteredError(OrchestratorError):
    http_status = 403
    code = "lti_platform_not_registered"


class CourseNotMappedError(OrchestratorError):
    http_status = 422
    code = "course_not_mapped"


@dataclass(slots=True)
class LoginRedirect:
    authorization_url: str
    state: str


@dataclass(slots=True)
class LaunchOutcome:
    stand_id: str
    redirect_url: str
    claims: LaunchClaims
    mapping: CourseMapping
    reused: bool = False


class LtiService:
    def __init__(
        self,
        session: AsyncSession,
        *,
        state_store: LaunchStateStore | None = None,
        stand_service: StandService | None = None,
    ) -> None:
        self._session = session
        self._state = state_store or LaunchStateStore()
        self._stand_service = stand_service or StandService(session, capacity=CapacityChecker())
        self._settings = get_settings()

    async def begin_login(
        self,
        *,
        iss: str,
        client_id: str | None,
        login_hint: str,
        target_link_uri: str,
        lti_message_hint: str | None,
        redirect_uri: str,
    ) -> LoginRedirect:
        platform = await self._resolve_platform(iss=iss, client_id=client_id)
        state = generate_state()
        nonce = generate_nonce()
        await self._state.put(
            LaunchState(
                state=state,
                nonce=nonce,
                platform_id=str(platform.id),
                client_id=platform.client_id,
                login_hint=login_hint,
                lti_message_hint=lti_message_hint,
                target_link_uri=target_link_uri,
            )
        )
        params = {
            "scope": "openid",
            "response_type": "id_token",
            "response_mode": "form_post",
            "prompt": "none",
            "client_id": platform.client_id,
            "redirect_uri": redirect_uri,
            "login_hint": login_hint,
            "state": state,
            "nonce": nonce,
        }
        if lti_message_hint:
            params["lti_message_hint"] = lti_message_hint
        query = urlencode(params)
        url = f"{platform.auth_login_url}?{query}"
        logger.info(
            "lti_login_initiated",
            iss=iss,
            client_id=platform.client_id,
            state=state,
        )
        return LoginRedirect(authorization_url=url, state=state)

    async def finish_launch(self, *, state: str, id_token: str) -> LaunchOutcome:
        stored = await self._state.pop(state)
        if stored is None:
            raise LtiStateExpiredError(
                "Launch state expired or already consumed — open the lab link in Moodle again",
                details={"state": state},
            )

        platform = await self._session.get(LtiPlatform, stored.platform_id)
        if platform is None or not platform.enabled:
            raise LtiPlatformNotRegisteredError("LTI platform record vanished or is disabled")

        claims = await validate_id_token(
            id_token=id_token,
            expected_nonce=stored.nonce,
            platform=platform,
        )

        owner_id = self._build_owner_id(platform=platform, claims=claims)
        await upsert_lti_user(
            self._session,
            platform_id=platform.id,
            subject=claims.subject,
            email=claims.email,
            name=claims.name,
            owner_external_id=owner_id,
            context_id=claims.context_id,
            context_title=claims.context_title,
            resource_link_id=claims.resource_link_id or None,
        )
        await self._session.commit()

        existing_stand = await self._find_active_stand(owner_id)
        if existing_stand is not None:
            mapping = await self._resolve_course_mapping(claims, owner_id=owner_id)
            redirect_url = self._settings.lti_frontend_launch_url.format(
                stand_id=str(existing_stand.id)
            )
            logger.info(
                "lti_launch_reused",
                stand_id=str(existing_stand.id),
                owner=owner_id,
                status=existing_stand.status.value,
            )
            return LaunchOutcome(
                stand_id=str(existing_stand.id),
                redirect_url=redirect_url,
                claims=claims,
                mapping=mapping,
                reused=True,
            )

        mapping = await self._resolve_course_mapping(claims, owner_id=owner_id)
        image_id, flavor_id, lab_code = self._apply_custom_overrides(claims, mapping)

        accepted = await self._stand_service.launch(
            StandLaunchRequest(
                owner_external_id=owner_id,
                owner_display_name=claims.name or claims.email,
                image_id=image_id,
                flavor_id=flavor_id,
                course_code=mapping.ki_domain_name,
                lab_code=lab_code,
                attach_floating_ip=False,
            )
        )
        redirect_url = self._settings.lti_frontend_launch_url.format(
            stand_id=str(accepted.stand.id)
        )
        logger.info(
            "lti_launch_completed",
            stand_id=str(accepted.stand.id),
            owner=owner_id,
            course=mapping.ki_domain_name,
            lab=lab_code,
            image_overridden=image_id != mapping.image_id,
            flavor_overridden=flavor_id != mapping.flavor_id,
        )
        return LaunchOutcome(
            stand_id=str(accepted.stand.id),
            redirect_url=redirect_url,
            claims=claims,
            mapping=mapping,
            reused=False,
        )

    async def _find_active_stand(self, owner_external_id: str) -> Stand | None:
        stmt = (
            select(Stand)
            .where(Stand.owner_external_id == owner_external_id)
            .order_by(Stand.created_at.desc())
            .limit(5)
        )
        candidates = list((await self._session.scalars(stmt)).all())
        for stand in candidates:
            if is_active(stand.status):
                return stand
        return None

    async def _resolve_platform(self, *, iss: str, client_id: str | None) -> LtiPlatform:
        stmt = select(LtiPlatform).where(LtiPlatform.issuer == iss, LtiPlatform.enabled.is_(True))
        if client_id:
            stmt = stmt.where(LtiPlatform.client_id == client_id)
        platforms = list((await self._session.scalars(stmt)).all())
        if not platforms:
            raise LtiPlatformNotRegisteredError(
                "No LTI platform registered for this issuer",
                details={"iss": iss, "client_id": client_id},
            )
        if len(platforms) > 1 and not client_id:
            raise LtiPlatformNotRegisteredError(
                "Multiple platforms match issuer; client_id is required",
                details={"iss": iss},
            )
        return platforms[0]

    async def _resolve_course_mapping(
        self,
        claims: LaunchClaims,
        *,
        owner_id: str | None = None,
    ) -> CourseMapping:
        if not claims.context_id:
            raise CourseNotMappedError(
                "id_token has no context.id, cannot map to a KI course",
                details={"hint": "Moodle must send the context claim — check Tool registration"},
            )

        link_id = claims.resource_link_id or None
        candidates: list[CourseMapping] = []
        if link_id:
            stmt = (
                select(CourseMapping)
                .where(CourseMapping.lti_context_id == claims.context_id)
                .where(CourseMapping.resource_link_id == link_id)
                .order_by(desc(CourseMapping.updated_at))
            )
            candidates = list((await self._session.scalars(stmt)).all())

        if not candidates:
            stmt = (
                select(CourseMapping)
                .where(CourseMapping.lti_context_id == claims.context_id)
                .where(CourseMapping.resource_link_id.is_(None))
                .order_by(desc(CourseMapping.updated_at))
            )
            candidates = list((await self._session.scalars(stmt)).all())

        if len(candidates) > 1:
            logger.warning(
                "lti_mapping_multiple_matches_picking_latest",
                context_id=claims.context_id,
                resource_link_id=link_id,
                picked=str(candidates[0].id),
                total=len(candidates),
            )

        if not candidates:
            await record_unmapped_launch(
                self._session,
                lti_context_id=claims.context_id,
                resource_link_id=link_id,
                context_title=claims.context_title,
                resource_link_title=claims.resource_link_title,
                user_external_id=owner_id,
                user_display_name=claims.name or claims.email,
            )
            await self._session.commit()
            raise CourseNotMappedError(
                "Курс ещё не настроен преподавателем. Запрос зафиксирован, попробуйте позже.",
                details={
                    "context_id": claims.context_id,
                    "context_title": claims.context_title,
                    "resource_link_id": link_id,
                    "resource_link_title": claims.resource_link_title,
                    "hint": (
                        "Преподаватель увидит этот запрос в админ-панели Cloud-Lab "
                        "и создаст соответствующий маппинг."
                    ),
                },
            )
        return candidates[0]

    @staticmethod
    def _apply_custom_overrides(
        claims: LaunchClaims, mapping: CourseMapping
    ) -> tuple[str, str, str]:
        custom = claims.custom or {}
        image_id = str(custom.get("ki_image") or custom.get("image_id") or mapping.image_id)
        flavor_id = str(custom.get("ki_flavor") or custom.get("flavor_id") or mapping.flavor_id)
        lab_code = str(custom.get("lab_id") or custom.get("lab_code") or mapping.lab_code)
        return image_id, flavor_id, lab_code

    @staticmethod
    def _build_owner_id(*, platform: LtiPlatform, claims: LaunchClaims) -> str:
        return f"{platform.id}:{claims.subject}"

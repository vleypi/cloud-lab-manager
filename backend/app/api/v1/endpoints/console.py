import time
from uuid import UUID

import structlog
from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Path,
    Query,
    WebSocket,
    WebSocketDisconnect,
    status,
)
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import (
    cloud_provider,
    credentials_store,
    current_user,
    db_session,
)
from app.config import get_settings
from app.core.exceptions import ConsoleNotAvailableError
from app.core.security import TokenError, verify_access_token
from app.db.session import get_session
from app.models.stand import Stand, StandStatus
from app.models.user import User
from app.providers import CloudProvider
from app.schemas.stand import ConsoleTokenOut, ConsoleUrlOut
from app.services.auth_service import AuthService
from app.services.console_session import ConsoleSessionBuilder
from app.services.console_token_store import ConsoleTokenStore
from app.services.credentials_store import CredentialsStore
from app.services.guacd_bridge import (
    GuacdBridge,
    GuacdConnectError,
    GuacdHandshakeError,
)

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/stands", tags=["console"])


WS_CLOSE_UNAUTHORIZED = 4401
WS_CLOSE_FORBIDDEN = 4403
WS_CLOSE_NOT_FOUND = 4404
WS_CLOSE_NOT_READY = 4409
WS_CLOSE_BACKEND_ERROR = 4500


_token_store_singleton: ConsoleTokenStore | None = None


def console_token_store() -> ConsoleTokenStore:
    global _token_store_singleton
    if _token_store_singleton is None:
        _token_store_singleton = ConsoleTokenStore()
    return _token_store_singleton


@router.get(
    "/{stand_id}/console-url",
    response_model=ConsoleUrlOut,
)
async def get_stand_console_url(
    stand_id: UUID = Path(...),
    user: User = Depends(current_user),
    session: AsyncSession = Depends(db_session),
    provider: CloudProvider = Depends(cloud_provider),
) -> ConsoleUrlOut:
    stand = await session.scalar(select(Stand).where(Stand.id == stand_id))
    if stand is None:
        raise HTTPException(status_code=404, detail="stand_not_found")

    if not user.is_super_admin and stand.owner_external_id != user.external_id:
        raise HTTPException(status_code=403, detail="forbidden")

    if stand.status != StandStatus.READY:
        raise HTTPException(status_code=409, detail=f"stand_status_{stand.status.value}")

    if not stand.ki_server_id:
        raise HTTPException(status_code=409, detail="stand_has_no_server_id")

    project_id = stand.pool_project.ki_project_id
    try:
        raw_url = await provider.get_vnc_console_url(project_id, stand.ki_server_id)
    except Exception as exc:  # noqa: BLE001
        logger.warning(
            "console_url_failed",
            stand_id=str(stand_id),
            server_id=stand.ki_server_id,
            error=str(exc)[:200],
        )
        raise HTTPException(status_code=502, detail="console_url_unavailable") from exc

    proxied_url = _rewrite_console_url_to_proxy(raw_url)

    logger.info(
        "console_url_issued",
        stand_id=str(stand_id),
        server_id=stand.ki_server_id,
        user_external_id=user.external_id,
        proxied=proxied_url != raw_url,
    )
    return ConsoleUrlOut(url=proxied_url, type="novnc", rewrite=proxied_url != raw_url)


def _rewrite_console_url_to_proxy(raw_url: str) -> str:
    from urllib.parse import urlparse, urlunparse

    try:
        parsed = urlparse(raw_url)
    except ValueError:
        return raw_url

    path = parsed.path or "/"
    if path.startswith("/"):
        new_path = "/console-proxy" + path
    else:
        new_path = "/console-proxy/" + path

    return urlunparse(("", "", new_path, parsed.params, parsed.query, parsed.fragment))


@router.post(
    "/{stand_id}/console/token",
    response_model=ConsoleTokenOut,
    status_code=status.HTTP_201_CREATED,
)
async def issue_console_token(
    stand_id: UUID = Path(...),
    user: User = Depends(current_user),
    creds: CredentialsStore = Depends(credentials_store),
    session: AsyncSession = Depends(db_session),
    tokens: ConsoleTokenStore = Depends(console_token_store),
) -> ConsoleTokenOut:
    builder = ConsoleSessionBuilder(session, credentials_store=creds)
    await builder.build(
        stand_id,
        owner_external_id=user.external_id,
        is_super_admin=user.is_super_admin,
    )

    token, ttl = await tokens.issue(stand_id=str(stand_id), user_id=str(user.id))
    return ConsoleTokenOut(
        token=token,
        expires_in=ttl,
        ws_url=f"/api/v1/stands/{stand_id}/console?token={token}",
    )


@router.websocket("/{stand_id}/console")
async def stand_console_ws(
    websocket: WebSocket,
    stand_id: UUID = Path(...),
    token: str | None = Query(default=None),
    width: int | None = Query(default=None),
    height: int | None = Query(default=None),
    dpi: int | None = Query(default=None),
) -> None:
    await websocket.accept(subprotocol="guacamole")

    user = await _resolve_user(websocket, token=token)
    if user is None:
        await websocket.close(code=WS_CLOSE_UNAUTHORIZED)
        return

    started = time.monotonic()
    bridge: GuacdBridge | None = None
    close_code: int | None = None
    protocol = "?"

    try:
        async for session in get_session():
            creds = CredentialsStore()
            try:
                builder = ConsoleSessionBuilder(session, credentials_store=creds)
                conn = await builder.build(
                    stand_id,
                    owner_external_id=user.external_id,
                    is_super_admin=user.is_super_admin,
                    width=width,
                    height=height,
                    dpi=dpi,
                )
            except ConsoleNotAvailableError as exc:
                code = _map_not_available_code(exc)
                close_code = code
                logger.info(
                    "console_session_rejected",
                    stand_id=str(stand_id),
                    user_external_id=user.external_id,
                    reason=exc.message,
                    code=code,
                )
                await websocket.close(code=code, reason=exc.message[:120])
                return
            finally:
                await creds.close()

            protocol = conn.protocol
            logger.info(
                "console_session_started",
                stand_id=str(stand_id),
                user_external_id=user.external_id,
                protocol=protocol,
                host=conn.hostname,
                port=conn.port,
            )

            bridge = GuacdBridge(websocket, conn)
            try:
                await bridge.run()
            except GuacdConnectError as exc:
                close_code = WS_CLOSE_BACKEND_ERROR
                logger.warning(
                    "console_guacd_connect_failed",
                    stand_id=str(stand_id),
                    error=str(exc),
                )
                await websocket.close(code=WS_CLOSE_BACKEND_ERROR, reason="guacd unavailable")
                return
            except GuacdHandshakeError as exc:
                close_code = WS_CLOSE_BACKEND_ERROR
                logger.warning(
                    "console_guacd_handshake_failed",
                    stand_id=str(stand_id),
                    error=str(exc),
                )
                await websocket.close(
                    code=WS_CLOSE_BACKEND_ERROR, reason="console service not ready"
                )
                return
            break
    except WebSocketDisconnect:
        pass
    except Exception as exc:
        close_code = WS_CLOSE_BACKEND_ERROR
        logger.exception(
            "console_session_error", stand_id=str(stand_id), error=str(exc)
        )
        try:
            await websocket.close(code=WS_CLOSE_BACKEND_ERROR, reason="internal error")
        except Exception:
            pass
    finally:
        duration_ms = int((time.monotonic() - started) * 1000)
        logger.info(
            "console_session_ended",
            stand_id=str(stand_id),
            user_external_id=user.external_id if user else None,
            protocol=protocol,
            duration_ms=duration_ms,
            bytes_in=bridge.bytes_in if bridge else 0,
            bytes_out=bridge.bytes_out if bridge else 0,
            close_code=close_code,
        )


async def _resolve_user(websocket: WebSocket, *, token: str | None) -> User | None:
    settings = get_settings()
    cookie_token = websocket.cookies.get(settings.cookie_access_name)

    user_id: str | None = None

    if cookie_token:
        try:
            payload = verify_access_token(cookie_token)
            user_id = payload.subject
        except TokenError:
            user_id = None

    if user_id is None and token:
        store = console_token_store()
        consumed = await store.consume(token)
        if consumed is None:
            return None
        user_id, _stand_id = consumed

    if user_id is None:
        return None

    try:
        uid = UUID(user_id)
    except (TypeError, ValueError):
        return None

    async for session in get_session():
        svc = AuthService(session)
        user = await svc.get_by_id(uid)
        return user

    return None


def _map_not_available_code(exc: ConsoleNotAvailableError) -> int:
    reason = (exc.details or {}).get("reason")
    if reason == "not_owner":
        return WS_CLOSE_FORBIDDEN
    if "not found" in exc.message.lower():
        return WS_CLOSE_NOT_FOUND
    if "not ready" in exc.message.lower():
        return WS_CLOSE_NOT_READY
    if "no reachable" in exc.message.lower():
        return WS_CLOSE_NOT_READY
    return WS_CLOSE_NOT_READY

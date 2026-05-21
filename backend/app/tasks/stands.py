import asyncio
import secrets
from datetime import datetime, timedelta, timezone
from uuid import UUID

import structlog
from celery import Task
from celery.exceptions import Retry
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.celery_app import celery_app
from app.core.exceptions import CloudProviderError
from app.db.session import SyncSessionLocal
from app.core.cloud_init import build_user_data
from app.models.project import PoolProject, ProjectStatus
from app.models.runtime_settings import KEY_DEFAULT_TTL
from app.models.stand import Stand, StandStatus
from app.providers import get_cloud_provider
from app.services.credentials_store import StandCredentials, SyncCredentialsStore
from app.services.lifecycle_settings import SyncLifecycleSettings
from app.core.state_machine import assert_transition

logger = structlog.get_logger(__name__)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _load_stand(session: Session, stand_id: UUID) -> Stand | None:
    return session.execute(select(Stand).where(Stand.id == stand_id)).scalar_one_or_none()


def _load_project(session: Session, project_id: UUID) -> PoolProject:
    return session.execute(
        select(PoolProject).where(PoolProject.id == project_id)
    ).scalar_one()


def _transition(stand: Stand, to: StandStatus, *, reason: str | None = None) -> None:
    assert_transition(stand.status, to)
    stand.status = to
    if reason is not None:
        stand.status_reason = reason[:1024]


@celery_app.task(
    name="stands.provision",
    bind=True,
    autoretry_for=(CloudProviderError, ConnectionError, TimeoutError),
    retry_backoff=True,
    retry_backoff_max=60,
    retry_jitter=True,
    max_retries=3,
    acks_late=True,
)
def provision_stand(self: Task, stand_id: str) -> dict:
    sid = UUID(stand_id)
    provider = get_cloud_provider()
    creds_store = SyncCredentialsStore()

    with SyncSessionLocal() as session:
        stand = _load_stand(session, sid)
        if stand is None:
            logger.warning("provision_missing_stand", stand_id=stand_id)
            return {"status": "missing"}
        if stand.status not in (StandStatus.ALLOCATING, StandStatus.DEPLOYING):
            logger.info(
                "provision_skipped_terminal",
                stand_id=stand_id,
                status=stand.status.value,
            )
            return {"status": stand.status.value}

        project = _load_project(session, stand.pool_project_id)
        if not project.ki_network_id:
            _mark_failed(session, stand, project, "Leased project has no preallocated network")
            return {"status": "failed"}

        stand.task_id = self.request.id
        stand.attempt = (stand.attempt or 0) + 1
        session.commit()

        if stand.ki_keypair_name and stand.status == StandStatus.DEPLOYING:
            try:
                asyncio.run(
                    provider.delete_keypair(project.ki_project_id, stand.ki_keypair_name)
                )
            except CloudProviderError as exc:
                logger.warning(
                    "stale_keypair_cleanup_failed",
                    stand_id=stand_id,
                    error=str(exc),
                )
        keypair_name = f"stand-{stand.id}-{secrets.token_hex(4)}"
        try:
            keypair = asyncio.run(provider.create_keypair(project.ki_project_id, keypair_name))
        except CloudProviderError as exc:
            logger.warning("provision_keypair_failed", stand_id=stand_id, error=str(exc))
            raise
        creds_store.put(
            stand_id,
            StandCredentials(
                ssh_public_key=keypair.public_key,
                ssh_private_key=keypair.private_key,
                fingerprint=keypair.fingerprint,
                keypair_name=keypair.name,
            ),
        )
        stand.ki_keypair_name = keypair.name
        stand.ssh_public_key_fingerprint = keypair.fingerprint
        if stand.status == StandStatus.ALLOCATING:
            _transition(stand, StandStatus.DEPLOYING, reason=None)
        session.commit()

        if stand.ki_server_id:
            try:
                deployed = asyncio.run(
                    provider.get_server(project.ki_project_id, stand.ki_server_id)
                )
            except CloudProviderError:
                stand.ki_server_id = None
                session.commit()
                deployed = None
        else:
            deployed = None

        if deployed is None:
            user_data = build_user_data()
            try:
                deployed = asyncio.run(
                    provider.create_server(
                        project_id=project.ki_project_id,
                        name=f"lab-{stand.lab_code or 'generic'}-{str(stand.id)[:8]}",
                        image_id=stand.image_id,
                        flavor_id=stand.flavor_id,
                        network_id=project.ki_network_id,
                        keypair_name=keypair.name,
                        user_data=user_data,
                        metadata={
                            "owner_external_id": stand.owner_external_id,
                            "stand_id": str(stand.id),
                            "course_code": stand.course_code or "",
                            "lab_code": stand.lab_code or "",
                        },
                    )
                )
            except CloudProviderError as exc:
                logger.warning("provision_server_failed", stand_id=stand_id, error=str(exc))
                raise
            stand.ki_server_id = deployed.id
            session.commit()

        floating_ip: str | None = None
        try:
            floating_ip = asyncio.run(
                provider.attach_floating_ip(
                    project_id=project.ki_project_id,
                    server_id=deployed.id,
                )
            )
        except CloudProviderError as exc:
            logger.warning("provision_floating_ip_failed", stand_id=stand_id, error=str(exc))
        stand.ki_floating_ip = floating_ip
        stand.extra = {**(stand.extra or {}), "fixed_ips": deployed.fixed_ips}

        ttl_seconds = SyncLifecycleSettings(session).get_int(KEY_DEFAULT_TTL)
        stand.deployed_at = _now()
        stand.expires_at = stand.deployed_at + timedelta(seconds=ttl_seconds)
        _transition(stand, StandStatus.READY, reason=None)
        session.commit()

        logger.info(
            "stand_ready",
            stand_id=stand_id,
            owner=stand.owner_external_id,
            project=project.ki_project_name,
            server_id=deployed.id,
            floating_ip=floating_ip,
            ttl_seconds=ttl_seconds,
            attempt=stand.attempt,
        )
        return {
            "status": "ready",
            "server_id": deployed.id,
            "floating_ip": floating_ip,
        }


def _mark_failed(
    session: Session, stand: Stand, project: PoolProject, reason: str
) -> None:
    provider = get_cloud_provider()
    creds_store = SyncCredentialsStore()
    logger.error("stand_failed", stand_id=str(stand.id), reason=reason)
    try:
        _transition(stand, StandStatus.FAILED, reason=reason)
    except Exception:
        stand.status = StandStatus.FAILED
        stand.status_reason = reason[:1024]
    session.commit()

    if stand.ki_server_id:
        try:
            asyncio.run(provider.delete_server(project.ki_project_id, stand.ki_server_id))
        except CloudProviderError as exc:
            logger.warning("cleanup_server_failed", stand_id=str(stand.id), error=str(exc))
    if stand.ki_keypair_name:
        try:
            asyncio.run(provider.delete_keypair(project.ki_project_id, stand.ki_keypair_name))
        except CloudProviderError as exc:
            logger.warning("cleanup_keypair_failed", stand_id=str(stand.id), error=str(exc))
    creds_store.delete(str(stand.id))

    project.status = ProjectStatus.FREE
    project.last_released_at = _now()
    session.commit()


@celery_app.task(
    name="stands.destroy",
    bind=True,
    autoretry_for=(CloudProviderError, ConnectionError, TimeoutError),
    retry_backoff=True,
    retry_backoff_max=60,
    retry_jitter=True,
    max_retries=5,
    acks_late=True,
)
def destroy_stand(self: Task, stand_id: str) -> dict:
    sid = UUID(stand_id)
    provider = get_cloud_provider()
    creds_store = SyncCredentialsStore()

    with SyncSessionLocal() as session:
        stand = _load_stand(session, sid)
        if stand is None:
            return {"status": "missing"}
        if stand.status in (StandStatus.DESTROYED,):
            return {"status": "already_destroyed"}
        if stand.status == StandStatus.FROZEN:
            logger.info("destroy_skipped_frozen", stand_id=stand_id)
            return {"status": "frozen"}

        project = _load_project(session, stand.pool_project_id)

        previous = stand.status
        stand.task_id = self.request.id
        try:
            _transition(stand, StandStatus.CLEANING, reason="destroy requested")
        except Exception:
            pass
        session.commit()

        if stand.ki_server_id:
            asyncio.run(provider.delete_server(project.ki_project_id, stand.ki_server_id))
        if stand.ki_keypair_name:
            asyncio.run(provider.delete_keypair(project.ki_project_id, stand.ki_keypair_name))
        creds_store.delete(stand_id)

        stand.status = StandStatus.DESTROYED
        stand.destroyed_at = _now()

        project.status = ProjectStatus.FREE
        project.last_released_at = _now()

        session.commit()
        logger.info(
            "stand_destroyed",
            stand_id=stand_id,
            previous_status=previous.value,
            attempt=(stand.attempt or 0),
        )
        return {"status": "destroyed"}


@celery_app.task(name="stands.sweep_expired", bind=True)
def sweep_expired(self: Task) -> dict:
    now = _now()
    enqueued: list[str] = []
    with SyncSessionLocal() as session:
        candidates = session.execute(
            select(Stand)
            .where(Stand.status.in_((StandStatus.READY, StandStatus.FAILED)))
            .where(Stand.expires_at.is_not(None))
            .where(Stand.expires_at <= now)
            .with_for_update(skip_locked=True, of=Stand.__table__)
        ).scalars().all()
        for stand in candidates:
            stand.task_id = "sweep-pending"
            destroy_stand.delay(str(stand.id))
            enqueued.append(str(stand.id))
        session.commit()

    if enqueued:
        logger.info("sweep_enqueued", count=len(enqueued), stand_ids=enqueued)
    return {"enqueued": len(enqueued)}


_ = Retry

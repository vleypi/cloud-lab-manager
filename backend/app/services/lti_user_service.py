from __future__ import annotations

import uuid
from datetime import UTC, datetime

import structlog
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.lti_user import LtiUser

logger = structlog.get_logger(__name__)


async def upsert_lti_user(
    session: AsyncSession,
    *,
    platform_id: uuid.UUID,
    subject: str,
    email: str | None,
    name: str | None,
    owner_external_id: str,
    context_id: str | None,
    context_title: str | None,
    resource_link_id: str | None,
) -> LtiUser:
    now = datetime.now(UTC)
    stmt = select(LtiUser).where(
        LtiUser.platform_id == platform_id,
        LtiUser.subject == subject,
    )
    existing = await session.scalar(stmt)
    if existing is None:
        user = LtiUser(
            platform_id=platform_id,
            subject=subject,
            email=email,
            name=name,
            owner_external_id=owner_external_id,
            last_context_id=context_id,
            last_context_title=context_title,
            last_resource_link_id=resource_link_id,
            login_count=1,
            last_seen_at=now,
        )
        session.add(user)
        await session.flush()
        logger.info(
            "lti_user_registered",
            platform_id=str(platform_id),
            subject=subject,
            owner=owner_external_id,
        )
        return user

    existing.login_count += 1
    existing.last_seen_at = now
    if email:
        existing.email = email
    if name:
        existing.name = name
    if context_id:
        existing.last_context_id = context_id
    if context_title:
        existing.last_context_title = context_title
    if resource_link_id is not None:
        existing.last_resource_link_id = resource_link_id
    existing.owner_external_id = owner_external_id
    await session.flush()
    return existing


class LtiUserReader:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def list_recent(
        self,
        *,
        limit: int = 100,
        offset: int = 0,
        platform_id: uuid.UUID | None = None,
        search: str | None = None,
    ) -> list[LtiUser]:
        stmt = select(LtiUser).order_by(desc(LtiUser.last_seen_at))
        if platform_id is not None:
            stmt = stmt.where(LtiUser.platform_id == platform_id)
        if search:
            like = f"%{search.lower()}%"
            stmt = stmt.where(
                func.lower(func.coalesce(LtiUser.email, "")).like(like)
                | func.lower(func.coalesce(LtiUser.name, "")).like(like)
                | func.lower(LtiUser.subject).like(like)
            )
        stmt = stmt.limit(min(max(limit, 1), 500)).offset(max(offset, 0))
        return list((await self._session.scalars(stmt)).all())

    async def count(
        self,
        *,
        platform_id: uuid.UUID | None = None,
        search: str | None = None,
    ) -> int:
        stmt = select(func.count(LtiUser.id))
        if platform_id is not None:
            stmt = stmt.where(LtiUser.platform_id == platform_id)
        if search:
            like = f"%{search.lower()}%"
            stmt = stmt.where(
                func.lower(func.coalesce(LtiUser.email, "")).like(like)
                | func.lower(func.coalesce(LtiUser.name, "")).like(like)
                | func.lower(LtiUser.subject).like(like)
            )
        return int((await self._session.scalar(stmt)) or 0)

from __future__ import annotations

from datetime import UTC, datetime

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.lti import CourseMapping, PendingLtiBinding

logger = structlog.get_logger(__name__)


async def record_unmapped_launch(
    session: AsyncSession,
    *,
    lti_context_id: str,
    resource_link_id: str | None,
    context_title: str | None = None,
    resource_link_title: str | None = None,
    user_external_id: str | None = None,
    user_display_name: str | None = None,
) -> PendingLtiBinding:
    now = datetime.now(UTC)
    stmt = select(PendingLtiBinding).where(
        PendingLtiBinding.lti_context_id == lti_context_id,
        PendingLtiBinding.resource_link_id == resource_link_id,
    )
    existing = await session.scalar(stmt)

    if existing is None:
        pending = PendingLtiBinding(
            lti_context_id=lti_context_id,
            resource_link_id=resource_link_id,
            context_title=context_title,
            resource_link_title=resource_link_title,
            last_user_external_id=user_external_id,
            last_user_display_name=user_display_name,
            seen_count=1,
            last_seen_at=now,
        )
        session.add(pending)
        await session.flush()
        logger.info(
            "pending_lti_binding_created",
            lti_context_id=lti_context_id,
            resource_link_id=resource_link_id,
            context_title=context_title,
            resource_link_title=resource_link_title,
        )
        return pending

    existing.seen_count += 1
    existing.last_seen_at = now
    if context_title:
        existing.context_title = context_title
    if resource_link_title:
        existing.resource_link_title = resource_link_title
    if user_external_id:
        existing.last_user_external_id = user_external_id
    if user_display_name:
        existing.last_user_display_name = user_display_name
    await session.flush()
    logger.info(
        "pending_lti_binding_touched",
        lti_context_id=lti_context_id,
        resource_link_id=resource_link_id,
        seen_count=existing.seen_count,
    )
    return existing


async def drop_pending_for_mapping(session: AsyncSession, mapping: CourseMapping) -> int:
    stmt = select(PendingLtiBinding).where(
        PendingLtiBinding.lti_context_id == mapping.lti_context_id,
    )
    if mapping.resource_link_id is None:
        candidates = (await session.scalars(stmt)).all()
    else:
        candidates = (
            await session.scalars(
                stmt.where(
                    (PendingLtiBinding.resource_link_id == mapping.resource_link_id)
                    | (PendingLtiBinding.resource_link_id.is_(None))
                )
            )
        ).all()

    removed = 0
    for pending in candidates:
        await session.delete(pending)
        removed += 1
    if removed:
        await session.flush()
        logger.info(
            "pending_lti_bindings_resolved",
            mapping_id=str(mapping.id),
            lti_context_id=mapping.lti_context_id,
            resource_link_id=mapping.resource_link_id,
            removed=removed,
        )
    return removed

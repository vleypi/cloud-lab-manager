"""Сервис для записи входящих LTI-запросов без маппинга — препод видит их в админке
и одним кликом создаёт CourseMapping без копипаста id из Moodle.
"""

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
    """Upsert: если такая пара уже ждёт привязки — инкрементим счётчик и обновляем
    last_seen_at; иначе создаём новую запись. Идемпотентно по (context_id, link_id).
    """
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
    # обновляем человеческие заголовки только если пришли непустые — Moodle может
    # их переименовать со временем, забывать старое не страшно
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
    """Когда препод создал/обновил CourseMapping — снимаем pending-записи,
    которые на него теперь матчатся. Возвращает кол-во удалённых.
    Точное совпадение по (context_id, resource_link_id), плюс fallback на
    pending с тем же context_id и пустым resource_link_id (если маппинг тоже без link).
    """
    stmt = select(PendingLtiBinding).where(
        PendingLtiBinding.lti_context_id == mapping.lti_context_id,
    )
    if mapping.resource_link_id is None:
        # маппинг-fallback (без link) сматчит ВСЕ pending этого контекста
        candidates = (await session.scalars(stmt)).all()
    else:
        # точный маппинг — снимает pending с тем же link, плюс «пустой» pending на этот же контекст
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

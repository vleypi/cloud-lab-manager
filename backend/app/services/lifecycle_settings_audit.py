from __future__ import annotations

from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.lifecycle_audit import LifecycleSettingChange


class LifecycleSettingsAuditReader:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def list_recent(
        self,
        *,
        limit: int = 100,
        offset: int = 0,
        key: str | None = None,
    ) -> list[LifecycleSettingChange]:
        stmt = select(LifecycleSettingChange).order_by(desc(LifecycleSettingChange.created_at))
        if key is not None:
            stmt = stmt.where(LifecycleSettingChange.key == key)
        stmt = stmt.limit(min(max(limit, 1), 500)).offset(max(offset, 0))
        return list((await self._session.scalars(stmt)).all())

    async def count(self, *, key: str | None = None) -> int:
        stmt = select(func.count(LifecycleSettingChange.id))
        if key is not None:
            stmt = stmt.where(LifecycleSettingChange.key == key)
        return int((await self._session.scalar(stmt)) or 0)

import time
from dataclasses import dataclass

import structlog
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models.lifecycle_audit import LifecycleSettingChange
from app.models.runtime_settings import (
    KEY_CAPACITY_THRESHOLD,
    KEY_DEFAULT_TTL,
    KEY_FREEZE_TTL,
    RuntimeSetting,
)

logger = structlog.get_logger(__name__)


@dataclass(slots=True)
class _Cached:
    value: str
    captured_at: float


_CACHE: dict[str, _Cached] = {}
_CACHE_TTL_SECONDS = 5.0


def _is_fresh(entry: _Cached) -> bool:
    return (time.monotonic() - entry.captured_at) < _CACHE_TTL_SECONDS


def _cache_get(key: str) -> str | None:
    entry = _CACHE.get(key)
    if entry is None or not _is_fresh(entry):
        return None
    return entry.value


def _cache_put(key: str, value: str) -> None:
    _CACHE[key] = _Cached(value=value, captured_at=time.monotonic())


def invalidate_cache(key: str | None = None) -> None:
    if key is None:
        _CACHE.clear()
    else:
        _CACHE.pop(key, None)


class LifecycleSettings:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session
        self._defaults = _hardcoded_defaults()

    async def get_str(self, key: str) -> str:
        cached = _cache_get(key)
        if cached is not None:
            return cached
        stored = await self._session.scalar(
            select(RuntimeSetting.value).where(RuntimeSetting.key == key)
        )
        value = stored if stored is not None else self._defaults[key]
        _cache_put(key, value)
        return value

    async def get_int(self, key: str) -> int:
        return int(await self.get_str(key))

    async def get_float(self, key: str) -> float:
        return float(await self.get_str(key))

    async def all(self) -> dict[str, str]:
        result = await self._session.execute(select(RuntimeSetting.key, RuntimeSetting.value))
        stored = dict(result.all())
        return {**self._defaults, **stored}

    async def set_value(self, key: str, value: str, *, updated_by: str | None = None) -> str:
        if key not in self._defaults:
            raise KeyError(f"Unknown runtime setting: {key}")

        previous = await self._session.scalar(
            select(RuntimeSetting.value).where(RuntimeSetting.key == key)
        )
        previous_value = previous if previous is not None else self._defaults.get(key)

        if previous_value == value:
            invalidate_cache(key)
            logger.info(
                "runtime_setting_no_change",
                key=key,
                value=value,
                updated_by=updated_by,
            )
            return value

        stmt = (
            pg_insert(RuntimeSetting)
            .values(key=key, value=value, updated_by=updated_by)
            .on_conflict_do_update(
                index_elements=[RuntimeSetting.key],
                set_={"value": value, "updated_by": updated_by},
            )
        )
        await self._session.execute(stmt)
        self._session.add(
            LifecycleSettingChange(
                key=key,
                old_value=previous_value,
                new_value=value,
                updated_by=updated_by,
            )
        )
        await self._session.commit()
        invalidate_cache(key)
        logger.info(
            "runtime_setting_updated",
            key=key,
            old_value=previous_value,
            new_value=value,
            updated_by=updated_by,
        )
        return value


class SyncLifecycleSettings:
    def __init__(self, session: Session) -> None:
        self._session = session
        self._defaults = _hardcoded_defaults()

    def get_str(self, key: str) -> str:
        cached = _cache_get(key)
        if cached is not None:
            return cached
        stored = self._session.scalar(select(RuntimeSetting.value).where(RuntimeSetting.key == key))
        value = stored if stored is not None else self._defaults[key]
        _cache_put(key, value)
        return value

    def get_int(self, key: str) -> int:
        return int(self.get_str(key))


def _hardcoded_defaults() -> dict[str, str]:
    settings = get_settings()
    return {
        KEY_DEFAULT_TTL: str(settings.stand_default_ttl_seconds),
        KEY_FREEZE_TTL: str(settings.stand_freeze_ttl_seconds),
        KEY_CAPACITY_THRESHOLD: str(settings.capacity_threshold_percent),
    }

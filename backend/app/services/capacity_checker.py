import asyncio
import time
from dataclasses import dataclass

import structlog

from app.config import get_settings
from app.core.exceptions import CapacityExceededError
from app.providers import CloudProvider, ClusterUtilization, get_cloud_provider

logger = structlog.get_logger(__name__)


@dataclass(slots=True, frozen=True)
class CapacityDecision:
    allowed: bool
    threshold_percent: float
    utilization: ClusterUtilization
    reason: str | None = None

    def as_dict(self) -> dict:
        return {
            "allowed": self.allowed,
            "threshold_percent": self.threshold_percent,
            "reason": self.reason,
            "utilization": {
                "max_percent": round(self.utilization.max_percent, 2),
                "vcpus": {
                    "used": self.utilization.vcpus.used,
                    "total": self.utilization.vcpus.total,
                    "percent": round(self.utilization.vcpus.percent, 2),
                },
                "memory_mb": {
                    "used": self.utilization.memory_mb.used,
                    "total": self.utilization.memory_mb.total,
                    "percent": round(self.utilization.memory_mb.percent, 2),
                },
                "local_gb": {
                    "used": self.utilization.local_gb.used,
                    "total": self.utilization.local_gb.total,
                    "percent": round(self.utilization.local_gb.percent, 2),
                },
                "running_vms": self.utilization.running_vms,
            },
        }


@dataclass(slots=True)
class _Snapshot:
    utilization: ClusterUtilization
    captured_at: float


class CapacityChecker:
    def __init__(
        self,
        provider: CloudProvider | None = None,
        *,
        threshold_percent: float | None = None,
        cache_ttl_seconds: int | None = None,
    ) -> None:
        settings = get_settings()
        self._provider = provider or get_cloud_provider()
        self._threshold = (
            threshold_percent
            if threshold_percent is not None
            else settings.capacity_threshold_percent
        )
        self._ttl = (
            cache_ttl_seconds
            if cache_ttl_seconds is not None
            else settings.capacity_cache_ttl_seconds
        )
        self._cache: _Snapshot | None = None
        self._lock = asyncio.Lock()

    @property
    def threshold_percent(self) -> float:
        return self._threshold

    def _cache_is_fresh(self, now: float, force: bool) -> bool:
        if force or self._cache is None:
            return False
        return (now - self._cache.captured_at) < self._ttl

    async def snapshot(self, *, force: bool = False) -> ClusterUtilization:
        now = time.monotonic()
        if self._cache_is_fresh(now, force):
            return self._cache.utilization
        async with self._lock:
            now = time.monotonic()
            if self._cache_is_fresh(now, force):
                return self._cache.utilization 
            utilization = await self._provider.get_cluster_utilization()
            self._cache = _Snapshot(utilization=utilization, captured_at=now)
            return utilization

    async def evaluate(self, *, threshold_override: float | None = None) -> CapacityDecision:
        utilization = await self.snapshot()
        threshold = threshold_override if threshold_override is not None else self._threshold
        max_pct = utilization.max_percent
        if max_pct >= threshold:
            reason = (
                f"KI cluster utilization {max_pct:.1f}% reached the "
                f"{threshold:.0f}% safety threshold"
            )
            return CapacityDecision(
                allowed=False,
                threshold_percent=threshold,
                utilization=utilization,
                reason=reason,
            )
        return CapacityDecision(
            allowed=True,
            threshold_percent=threshold,
            utilization=utilization,
        )

    async def assert_can_allocate(
        self,
        *,
        owner_external_id: str | None = None,
        threshold_override: float | None = None,
    ) -> CapacityDecision:
        decision = await self.evaluate(threshold_override=threshold_override)
        if not decision.allowed:
            details = decision.as_dict()
            logger.warning(
                "capacity_block",
                owner=owner_external_id,
                threshold=self._threshold,
                **details["utilization"],
            )
            raise CapacityExceededError(
                decision.reason or "Cluster capacity exhausted",
                details=details,
            )
        return decision

    def invalidate_snapshot(self) -> None:
        self._cache = None

import asyncio
import time
from dataclasses import dataclass

import structlog

from app.config import get_settings
from app.core.exceptions import CapacityExceededError
from app.providers import CloudFlavor, CloudProvider, ClusterUtilization, get_cloud_provider

logger = structlog.get_logger(__name__)

# если max_percent в кеше выше порога-этого-окна — кеш считается «горячим»
# и принудительно обновляется при следующем snapshot, чтобы не пропустить
# скачок утилизации в опасной зоне
_HOT_ZONE_MARGIN_PERCENT = 10.0


@dataclass(slots=True, frozen=True)
class FlavorRequirements:
    vcpus: int
    ram_mb: int
    disk_gb: int

    @classmethod
    def from_flavor(cls, flavor: CloudFlavor) -> "FlavorRequirements":
        return cls(vcpus=flavor.vcpus, ram_mb=flavor.ram_mb, disk_gb=flavor.disk_gb)


@dataclass(slots=True, frozen=True)
class CapacityDecision:
    allowed: bool
    threshold_percent: float
    utilization: ClusterUtilization
    reason: str | None = None
    projected_max_percent: float | None = None
    flavor: FlavorRequirements | None = None

    def as_dict(self) -> dict:
        body: dict = {
            "allowed": self.allowed,
            "threshold_percent": self.threshold_percent,
            "reason": self.reason,
            "projected_max_percent": (
                round(self.projected_max_percent, 2)
                if self.projected_max_percent is not None
                else None
            ),
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
        if self.flavor is not None:
            body["flavor"] = {
                "vcpus": self.flavor.vcpus,
                "ram_mb": self.flavor.ram_mb,
                "disk_gb": self.flavor.disk_gb,
            }
        return body


@dataclass(slots=True)
class _Snapshot:
    utilization: ClusterUtilization
    captured_at: float


def _projected_percent(used: float, total: float, requested: float) -> float:
    if total <= 0:
        return 0.0
    return ((used + max(requested, 0.0)) / total) * 100.0


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

    def _cache_is_fresh(self, now: float, force: bool, *, threshold: float | None = None) -> bool:
        if force or self._cache is None:
            return False
        if (now - self._cache.captured_at) >= self._ttl:
            return False
        # горячая зона: если текущая утилизация подобралась к порогу ближе чем
        # _HOT_ZONE_MARGIN_PERCENT, считаем кеш протухшим, чтобы не выдать allow
        # на устаревших данных
        effective_threshold = threshold if threshold is not None else self._threshold
        hot_zone_floor = max(0.0, effective_threshold - _HOT_ZONE_MARGIN_PERCENT)
        if self._cache.utilization.max_percent >= hot_zone_floor:
            return False
        return True

    async def snapshot(
        self,
        *,
        force: bool = False,
        threshold: float | None = None,
    ) -> ClusterUtilization:
        now = time.monotonic()
        if self._cache_is_fresh(now, force, threshold=threshold):
            return self._cache.utilization
        async with self._lock:
            now = time.monotonic()
            if self._cache_is_fresh(now, force, threshold=threshold):
                return self._cache.utilization
            utilization = await self._provider.get_cluster_utilization()
            self._cache = _Snapshot(utilization=utilization, captured_at=now)
            return utilization

    async def evaluate(
        self,
        *,
        threshold_override: float | None = None,
        flavor: FlavorRequirements | None = None,
    ) -> CapacityDecision:
        threshold = threshold_override if threshold_override is not None else self._threshold
        utilization = await self.snapshot(threshold=threshold)

        current_max = utilization.max_percent

        # предиктивная формула: учитываем ресурсы запрашиваемой ВМ
        if flavor is not None:
            projected = max(
                _projected_percent(
                    utilization.vcpus.used,
                    utilization.vcpus.total,
                    float(flavor.vcpus),
                ),
                _projected_percent(
                    utilization.memory_mb.used,
                    utilization.memory_mb.total,
                    float(flavor.ram_mb),
                ),
                _projected_percent(
                    utilization.local_gb.used,
                    utilization.local_gb.total,
                    float(flavor.disk_gb),
                ),
            )
        else:
            projected = current_max

        if projected >= threshold:
            reason = (
                f"KI cluster projected utilization {projected:.1f}% would reach the "
                f"{threshold:.0f}% safety threshold "
                f"(current {current_max:.1f}%)"
            )
            return CapacityDecision(
                allowed=False,
                threshold_percent=threshold,
                utilization=utilization,
                reason=reason,
                projected_max_percent=projected,
                flavor=flavor,
            )
        return CapacityDecision(
            allowed=True,
            threshold_percent=threshold,
            utilization=utilization,
            projected_max_percent=projected,
            flavor=flavor,
        )

    async def assert_can_allocate(
        self,
        *,
        owner_external_id: str | None = None,
        threshold_override: float | None = None,
        flavor: FlavorRequirements | None = None,
        flavor_id: str | None = None,
    ) -> CapacityDecision:
        decision = await self.evaluate(
            threshold_override=threshold_override,
            flavor=flavor,
        )
        if not decision.allowed:
            details = decision.as_dict()
            logger.warning(
                "capacity_block",
                owner=owner_external_id,
                threshold=decision.threshold_percent,
                projected=details["projected_max_percent"],
                flavor_id=flavor_id,
                **details["utilization"],
            )
            raise CapacityExceededError(
                decision.reason or "Cluster capacity exhausted",
                details=details,
            )
        return decision

    def invalidate_snapshot(self) -> None:
        self._cache = None

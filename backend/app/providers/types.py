import enum
from dataclasses import dataclass, field


class ServerStatus(str, enum.Enum):
    BUILD = "BUILD"
    ACTIVE = "ACTIVE"
    ERROR = "ERROR"
    SHUTOFF = "SHUTOFF"
    UNKNOWN = "UNKNOWN"


@dataclass(slots=True, frozen=True)
class ResourceUsage:
    used: float
    total: float

    @property
    def percent(self) -> float:
        if self.total <= 0:
            return 0.0
        return (self.used / self.total) * 100.0


@dataclass(slots=True, frozen=True)
class ClusterUtilization:
    vcpus: ResourceUsage
    memory_mb: ResourceUsage
    local_gb: ResourceUsage
    running_vms: int

    @property
    def max_percent(self) -> float:
        return max(self.vcpus.percent, self.memory_mb.percent, self.local_gb.percent)


@dataclass(slots=True, frozen=True)
class KeyPair:
    name: str
    fingerprint: str
    public_key: str
    private_key: str


@dataclass(slots=True, frozen=True)
class DeployedServer:
    id: str
    name: str
    status: ServerStatus
    fixed_ips: list[str] = field(default_factory=list)
    floating_ip: str | None = None


@dataclass(slots=True, frozen=True)
class CloudNetwork:
    id: str
    name: str
    cidr: str | None = None
    is_external: bool = False


@dataclass(slots=True, frozen=True)
class CloudImage:
    id: str
    name: str
    os_type: str | None = None
    size_mb: int | None = None


@dataclass(slots=True, frozen=True)
class CloudFlavor:
    id: str
    name: str
    vcpus: int
    ram_mb: int
    disk_gb: int


@dataclass(slots=True, frozen=True)
class KiDomain:
    id: str
    name: str


@dataclass(slots=True, frozen=True)
class KiProject:
    id: str
    name: str
    domain_id: str
    domain_name: str
    network_id: str | None = None
    router_id: str | None = None

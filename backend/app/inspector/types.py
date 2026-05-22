import enum
from dataclasses import dataclass, field


class CheckKind(str, enum.Enum):
    PACKAGE_INSTALLED = "package_installed"
    SYSTEMD_ACTIVE = "systemd_active"
    PORT_LISTENING = "port_listening"
    FILE_EXISTS = "file_exists"
    FILE_CONTAINS = "file_contains"
    COMMAND_EXIT_ZERO = "command_exit_zero"
    COMMAND_OUTPUT_MATCHES = "command_output_matches"
    OS_RELEASE = "os_release"
    USER_EXISTS = "user_exists"
    PROCESS_RUNNING = "process_running"
    HTTP_ENDPOINT = "http_endpoint"
    DNS_RESOLVES = "dns_resolves"
    COMMAND_OUTPUT_COMPARE = "command_output_compare"


class CheckSeverity(str, enum.Enum):
    CRITICAL = "critical"
    WARNING = "warning"
    INFO = "info"


class CheckSection(str, enum.Enum):
    OS = "os"
    SOFTWARE = "software"
    NETWORK = "network"
    OTHER = "other"


_KIND_DEFAULT_SECTION: dict[CheckKind, CheckSection] = {
    CheckKind.PACKAGE_INSTALLED: CheckSection.SOFTWARE,
    CheckKind.SYSTEMD_ACTIVE: CheckSection.SOFTWARE,
    CheckKind.PORT_LISTENING: CheckSection.NETWORK,
    CheckKind.FILE_EXISTS: CheckSection.OS,
    CheckKind.FILE_CONTAINS: CheckSection.OS,
    CheckKind.COMMAND_EXIT_ZERO: CheckSection.OTHER,
    CheckKind.COMMAND_OUTPUT_MATCHES: CheckSection.OTHER,
    CheckKind.OS_RELEASE: CheckSection.OS,
    CheckKind.USER_EXISTS: CheckSection.OS,
    CheckKind.PROCESS_RUNNING: CheckSection.OS,
    CheckKind.HTTP_ENDPOINT: CheckSection.NETWORK,
    CheckKind.DNS_RESOLVES: CheckSection.NETWORK,
    CheckKind.COMMAND_OUTPUT_COMPARE: CheckSection.OTHER,
}


def default_section_for(kind: CheckKind) -> CheckSection:
    return _KIND_DEFAULT_SECTION.get(kind, CheckSection.OTHER)


@dataclass(slots=True, frozen=True)
class CheckSpec:
    name: str
    kind: CheckKind
    params: dict[str, object]
    section: CheckSection = CheckSection.OTHER
    severity: CheckSeverity = CheckSeverity.CRITICAL


@dataclass(slots=True, frozen=True)
class CheckTemplate:
    name: str
    version: str | None
    description: str | None
    checks: list[CheckSpec]


CHECK_STATUS_PASSED = "passed"
CHECK_STATUS_FAILED = "failed"
CHECK_STATUS_SKIPPED = "skipped"
CHECK_STATUS_ERROR = "error"


@dataclass(slots=True)
class CheckOutcome:
    status: str
    message: str | None = None
    stdout: str | None = None
    stderr: str | None = None
    exit_code: int | None = None
    duration_ms: int | None = None


@dataclass(slots=True)
class RunReport:
    template_name: str
    template_version: str | None
    outcomes: list[tuple[CheckSpec, CheckOutcome]] = field(default_factory=list)

    @property
    def total(self) -> int:
        return len(self.outcomes)

    @property
    def passed(self) -> int:
        return sum(1 for _, o in self.outcomes if o.status == CHECK_STATUS_PASSED)

    @property
    def failed(self) -> int:
        return sum(1 for _, o in self.outcomes if o.status == CHECK_STATUS_FAILED)

    @property
    def errored(self) -> int:
        return sum(1 for _, o in self.outcomes if o.status == CHECK_STATUS_ERROR)

    @property
    def overall(self) -> str:
        if self.errored:
            return CHECK_STATUS_ERROR
        critical_failed = any(
            o.status == CHECK_STATUS_FAILED and spec.severity == CheckSeverity.CRITICAL
            for spec, o in self.outcomes
        )
        if critical_failed or self.failed:
            return CHECK_STATUS_FAILED
        return CHECK_STATUS_PASSED

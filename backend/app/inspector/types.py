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


@dataclass(slots=True, frozen=True)
class CheckSpec:
    name: str
    kind: CheckKind
    params: dict[str, object]


@dataclass(slots=True, frozen=True)
class CheckTemplate:
    name: str
    version: str | None
    description: str | None
    checks: list[CheckSpec]


# возможные значения CheckOutcome.status
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
        if self.failed:
            return CHECK_STATUS_FAILED
        return CHECK_STATUS_PASSED

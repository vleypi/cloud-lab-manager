import re
import shlex
from collections.abc import Awaitable, Callable

from app.inspector.ssh import SshSession
from app.inspector.types import CheckKind, CheckOutcome, CheckSpec

Handler = Callable[[CheckSpec, SshSession], Awaitable[CheckOutcome]]

_HANDLERS: dict[CheckKind, Handler] = {}


def register(kind: CheckKind) -> Callable[[Handler], Handler]:
    def deco(fn: Handler) -> Handler:
        _HANDLERS[kind] = fn
        return fn

    return deco


def handler_for(kind: CheckKind) -> Handler:
    try:
        return _HANDLERS[kind]
    except KeyError as exc:
        raise ValueError(f"No handler registered for check kind {kind.value!r}") from exc


def _required_param(spec: CheckSpec, key: str) -> object:
    value = spec.params.get(key)
    if value is None or value == "":
        raise KeyError(f"Check {spec.name!r}: required parameter {key!r} is missing")
    return value


def _passed(
    message: str, exit_code: int = 0, *, stdout: str = "", duration_ms: int = 0
) -> CheckOutcome:
    return CheckOutcome(
        status="passed",
        message=message,
        exit_code=exit_code,
        stdout=stdout,
        duration_ms=duration_ms,
    )


def _failed(
    message: str,
    *,
    exit_code: int | None = None,
    stdout: str = "",
    stderr: str = "",
    duration_ms: int = 0,
) -> CheckOutcome:
    return CheckOutcome(
        status="failed",
        message=message,
        exit_code=exit_code,
        stdout=stdout,
        stderr=stderr,
        duration_ms=duration_ms,
    )


def _errored(message: str) -> CheckOutcome:
    return CheckOutcome(status="error", message=message)


@register(CheckKind.PACKAGE_INSTALLED)
async def _package_installed(spec: CheckSpec, session: SshSession) -> CheckOutcome:
    package = str(_required_param(spec, "package"))
    manager = str(spec.params.get("manager", "")).lower() or None

    candidates = []
    if manager in (None, "dpkg", "apt"):
        candidates.append(f"dpkg -s {shlex.quote(package)}")
    if manager in (None, "rpm", "dnf", "yum"):
        candidates.append(f"rpm -q {shlex.quote(package)}")

    last_result = None
    for cmd in candidates:
        result = await session.run(cmd)
        last_result = result
        if result.exit_code == 0:
            return _passed(
                f"package {package!r} is installed",
                exit_code=result.exit_code,
                stdout=result.stdout,
                duration_ms=result.duration_ms,
            )
    assert last_result is not None
    return _failed(
        f"package {package!r} not found",
        exit_code=last_result.exit_code,
        stdout=last_result.stdout,
        stderr=last_result.stderr,
        duration_ms=last_result.duration_ms,
    )


@register(CheckKind.SYSTEMD_ACTIVE)
async def _systemd_active(spec: CheckSpec, session: SshSession) -> CheckOutcome:
    unit = str(_required_param(spec, "unit"))
    result = await session.run(f"sudo -n systemctl is-active {shlex.quote(unit)}")
    if result.exit_code == 0 and result.stdout.strip() == "active":
        return _passed(
            f"unit {unit!r} is active",
            exit_code=result.exit_code,
            stdout=result.stdout,
            duration_ms=result.duration_ms,
        )
    return _failed(
        f"unit {unit!r} is not active ({result.stdout.strip() or 'unknown'})",
        exit_code=result.exit_code,
        stdout=result.stdout,
        stderr=result.stderr,
        duration_ms=result.duration_ms,
    )


@register(CheckKind.PORT_LISTENING)
async def _port_listening(spec: CheckSpec, session: SshSession) -> CheckOutcome:
    port = int(_required_param(spec, "port"))  # type: ignore[arg-type]
    proto = str(spec.params.get("protocol", "tcp")).lower()
    if proto not in {"tcp", "udp"}:
        return _errored(f"unsupported protocol {proto!r}")
    flag = "-tln" if proto == "tcp" else "-uln"
    result = await session.run(f"sudo -n ss {flag}")
    pattern = re.compile(rf"[:\.]{port}\b")
    if result.exit_code == 0 and pattern.search(result.stdout):
        return _passed(
            f"port {port}/{proto} is listening",
            exit_code=result.exit_code,
            stdout=result.stdout,
            duration_ms=result.duration_ms,
        )
    return _failed(
        f"port {port}/{proto} is not listening",
        exit_code=result.exit_code,
        stdout=result.stdout,
        stderr=result.stderr,
        duration_ms=result.duration_ms,
    )


@register(CheckKind.FILE_EXISTS)
async def _file_exists(spec: CheckSpec, session: SshSession) -> CheckOutcome:
    path = str(_required_param(spec, "path"))
    result = await session.run(f"test -e {shlex.quote(path)}")
    if result.exit_code == 0:
        return _passed(
            f"path {path!r} exists",
            exit_code=result.exit_code,
            duration_ms=result.duration_ms,
        )
    return _failed(
        f"path {path!r} does not exist",
        exit_code=result.exit_code,
        stderr=result.stderr,
        duration_ms=result.duration_ms,
    )


@register(CheckKind.FILE_CONTAINS)
async def _file_contains(spec: CheckSpec, session: SshSession) -> CheckOutcome:
    path = str(_required_param(spec, "path"))
    pattern = str(_required_param(spec, "pattern"))
    result = await session.run(f"sudo -n cat {shlex.quote(path)}")
    if result.exit_code != 0:
        return _failed(
            f"cannot read {path!r}",
            exit_code=result.exit_code,
            stderr=result.stderr,
            duration_ms=result.duration_ms,
        )
    try:
        compiled = re.compile(pattern, re.MULTILINE)
    except re.error as exc:
        return _errored(f"invalid regex {pattern!r}: {exc}")
    if compiled.search(result.stdout):
        return _passed(
            f"{path!r} contains /{pattern}/",
            exit_code=result.exit_code,
            duration_ms=result.duration_ms,
        )
    return _failed(
        f"{path!r} does not match /{pattern}/",
        exit_code=result.exit_code,
        stdout=result.stdout[:4096],
        duration_ms=result.duration_ms,
    )


@register(CheckKind.COMMAND_EXIT_ZERO)
async def _command_exit_zero(spec: CheckSpec, session: SshSession) -> CheckOutcome:
    cmd = str(_required_param(spec, "cmd"))
    result = await session.run(cmd)
    if result.exit_code == 0:
        return _passed(
            f"command exited 0: {cmd!r}",
            exit_code=result.exit_code,
            stdout=result.stdout,
            duration_ms=result.duration_ms,
        )
    return _failed(
        f"command exited {result.exit_code}: {cmd!r}",
        exit_code=result.exit_code,
        stdout=result.stdout,
        stderr=result.stderr,
        duration_ms=result.duration_ms,
    )


@register(CheckKind.COMMAND_OUTPUT_MATCHES)
async def _command_output_matches(spec: CheckSpec, session: SshSession) -> CheckOutcome:
    cmd = str(_required_param(spec, "cmd"))
    pattern = str(_required_param(spec, "pattern"))
    result = await session.run(cmd)
    try:
        compiled = re.compile(pattern, re.MULTILINE)
    except re.error as exc:
        return _errored(f"invalid regex {pattern!r}: {exc}")
    if result.exit_code != 0:
        return _failed(
            f"command exited {result.exit_code} before regex check",
            exit_code=result.exit_code,
            stdout=result.stdout,
            stderr=result.stderr,
            duration_ms=result.duration_ms,
        )
    if compiled.search(result.stdout):
        return _passed(
            f"stdout matches /{pattern}/",
            exit_code=result.exit_code,
            stdout=result.stdout,
            duration_ms=result.duration_ms,
        )
    return _failed(
        f"stdout does not match /{pattern}/",
        exit_code=result.exit_code,
        stdout=result.stdout,
        duration_ms=result.duration_ms,
    )

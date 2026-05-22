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


def _parse_os_release(raw: str) -> dict[str, str]:
    out: dict[str, str] = {}
    for line in raw.splitlines():
        line = line.strip()
        if not line or "=" not in line:
            continue
        key, _, value = line.partition("=")
        out[key.strip()] = value.strip().strip('"').strip("'")
    return out


@register(CheckKind.OS_RELEASE)
async def _os_release(spec: CheckSpec, session: SshSession) -> CheckOutcome:
    result = await session.run("cat /etc/os-release")
    if result.exit_code != 0:
        return _failed(
            "cannot read /etc/os-release",
            exit_code=result.exit_code,
            stderr=result.stderr,
            duration_ms=result.duration_ms,
        )
    fields = _parse_os_release(result.stdout)
    expected_id = spec.params.get("id")
    expected_version = spec.params.get("version")
    expected_version_id = spec.params.get("version_id")
    expected_id_like = spec.params.get("id_like")

    mismatches: list[str] = []
    if expected_id is not None and str(expected_id).lower() != fields.get("ID", "").lower():
        mismatches.append(f"ID={fields.get('ID', '∅')} expected={expected_id}")
    if expected_version is not None and str(expected_version) not in fields.get("VERSION", ""):
        mismatches.append(
            f"VERSION={fields.get('VERSION', '∅')!r} does not contain {expected_version!r}"
        )
    if expected_version_id is not None and str(expected_version_id) != fields.get("VERSION_ID", ""):
        mismatches.append(
            f"VERSION_ID={fields.get('VERSION_ID', '∅')} expected={expected_version_id}"
        )
    if expected_id_like is not None:
        id_like_present = fields.get("ID_LIKE", "").split()
        if str(expected_id_like) not in id_like_present:
            mismatches.append(
                f"ID_LIKE={fields.get('ID_LIKE', '∅')!r} does not contain {expected_id_like!r}"
            )

    if mismatches:
        return _failed(
            "OS release mismatch: " + "; ".join(mismatches),
            exit_code=result.exit_code,
            stdout=result.stdout,
            duration_ms=result.duration_ms,
        )
    descriptor = fields.get("PRETTY_NAME") or fields.get("NAME", "")
    return _passed(
        f"OS matches expectations ({descriptor})",
        exit_code=result.exit_code,
        stdout=result.stdout,
        duration_ms=result.duration_ms,
    )


@register(CheckKind.USER_EXISTS)
async def _user_exists(spec: CheckSpec, session: SshSession) -> CheckOutcome:
    username = str(_required_param(spec, "username"))
    expected_groups = spec.params.get("groups") or []
    expected_shell = spec.params.get("shell")
    expected_uid = spec.params.get("uid")

    result = await session.run(f"getent passwd {shlex.quote(username)}")
    if result.exit_code != 0:
        return _failed(
            f"user {username!r} not found",
            exit_code=result.exit_code,
            stderr=result.stderr,
            duration_ms=result.duration_ms,
        )

    parts = result.stdout.strip().split(":")
    if len(parts) < 7:
        return _errored(f"malformed passwd entry: {result.stdout!r}")
    _, _, uid, _, _, _, shell = parts[0], parts[1], parts[2], parts[3], parts[4], parts[5], parts[6]

    mismatches: list[str] = []
    if expected_uid is not None and str(expected_uid) != uid:
        mismatches.append(f"uid={uid} expected={expected_uid}")
    if expected_shell is not None and str(expected_shell) != shell:
        mismatches.append(f"shell={shell!r} expected={expected_shell!r}")

    if expected_groups:
        groups_result = await session.run(f"id -nG {shlex.quote(username)}")
        if groups_result.exit_code != 0:
            mismatches.append(f"cannot read groups for {username}")
        else:
            actual_groups = set(groups_result.stdout.split())
            missing = [g for g in expected_groups if str(g) not in actual_groups]
            if missing:
                mismatches.append(f"missing groups: {missing}")

    if mismatches:
        return _failed(
            f"user {username!r} validation failed: " + "; ".join(mismatches),
            exit_code=result.exit_code,
            stdout=result.stdout,
            duration_ms=result.duration_ms,
        )
    return _passed(
        f"user {username!r} exists with expected attributes",
        exit_code=result.exit_code,
        stdout=result.stdout,
        duration_ms=result.duration_ms,
    )


@register(CheckKind.PROCESS_RUNNING)
async def _process_running(spec: CheckSpec, session: SshSession) -> CheckOutcome:
    name = str(_required_param(spec, "name"))
    min_count = int(spec.params.get("min_count", 1))  # type: ignore[arg-type]
    full_cmdline = bool(spec.params.get("full_cmdline", False))

    flag = "-fa" if full_cmdline else "-a"
    result = await session.run(f"pgrep {flag} {shlex.quote(name)}")
    if result.exit_code not in (0, 1):
        return _errored(f"pgrep failed: exit {result.exit_code}: {result.stderr.strip()}")
    matches = [ln for ln in result.stdout.splitlines() if ln.strip()]
    count = len(matches)
    if count < min_count:
        return _failed(
            f"process {name!r}: {count}/{min_count} instances running",
            exit_code=result.exit_code,
            stdout=result.stdout,
            duration_ms=result.duration_ms,
        )
    return _passed(
        f"process {name!r}: {count} instance(s) running",
        exit_code=result.exit_code,
        stdout=result.stdout,
        duration_ms=result.duration_ms,
    )


def _curl_command(url: str, *, method: str, timeout: int) -> str:
    flags = [
        "-sS",
        "--max-time",
        str(timeout),
        "-o",
        "/tmp/.inspector-body",
        "-w",
        r"\nHTTP_STATUS:%{http_code}\nHEADERS:\n",
        "-D",
        "-",
    ]
    if method.upper() != "GET":
        flags += ["-X", method.upper()]
    return (
        "curl "
        + " ".join(flags)
        + " "
        + shlex.quote(url)
        + " ; echo BODY: ; cat /tmp/.inspector-body 2>/dev/null ; rm -f /tmp/.inspector-body"
    )


@register(CheckKind.HTTP_ENDPOINT)
async def _http_endpoint(spec: CheckSpec, session: SshSession) -> CheckOutcome:
    url = str(_required_param(spec, "url"))
    method = str(spec.params.get("method", "GET"))
    expect_status = spec.params.get("expect_status")
    expect_body_contains = spec.params.get("expect_body_contains")
    expect_header_matches = spec.params.get("expect_header_matches")
    timeout_seconds = int(spec.params.get("timeout_seconds", 10))  # type: ignore[arg-type]

    cmd = _curl_command(url, method=method, timeout=timeout_seconds)
    result = await session.run(cmd, timeout=float(timeout_seconds + 5))

    body = ""
    headers = ""
    actual_status: int | None = None
    if "BODY:" in result.stdout:
        head, _, body = result.stdout.partition("BODY:")
        headers = head
        body = body.strip()
    else:
        headers = result.stdout

    for line in headers.splitlines():
        if line.startswith("HTTP_STATUS:"):
            try:
                actual_status = int(line.split(":", 1)[1].strip())
            except ValueError:
                actual_status = None
            break

    if actual_status is None:
        return _failed(
            f"could not extract HTTP status from response to {url}",
            exit_code=result.exit_code,
            stdout=result.stdout[:2048],
            stderr=result.stderr,
            duration_ms=result.duration_ms,
        )

    mismatches: list[str] = []
    if expect_status is not None and int(expect_status) != actual_status:
        mismatches.append(f"status={actual_status} expected={expect_status}")

    if expect_body_contains is not None and str(expect_body_contains) not in body:
        snippet = body[:200].replace("\n", " ")
        mismatches.append(f"body does not contain {expect_body_contains!r} (got {snippet!r}...)")

    if expect_header_matches is not None:
        try:
            compiled = re.compile(str(expect_header_matches), re.MULTILINE | re.IGNORECASE)
        except re.error as exc:
            return _errored(f"invalid header regex: {exc}")
        if not compiled.search(headers):
            mismatches.append(f"no header matches /{expect_header_matches}/")

    if mismatches:
        return _failed(
            f"HTTP {url} failed: " + "; ".join(mismatches),
            exit_code=result.exit_code,
            stdout=(headers + ("\n--BODY--\n" + body if body else ""))[:4096],
            stderr=result.stderr,
            duration_ms=result.duration_ms,
        )
    return _passed(
        f"HTTP {url} → {actual_status}",
        exit_code=result.exit_code,
        stdout=(headers + ("\n--BODY--\n" + body if body else ""))[:2048],
        duration_ms=result.duration_ms,
    )


@register(CheckKind.DNS_RESOLVES)
async def _dns_resolves(spec: CheckSpec, session: SshSession) -> CheckOutcome:
    hostname = str(_required_param(spec, "hostname"))
    expect_ip = spec.params.get("expect_ip")
    record_type = str(spec.params.get("record_type", "A")).upper()

    cmd = f"getent ahostsv4 {shlex.quote(hostname)}"
    if record_type == "AAAA":
        cmd = f"getent ahostsv6 {shlex.quote(hostname)}"
    elif record_type not in ("A", "AAAA"):
        cmd = f"dig +short {shlex.quote(record_type)} {shlex.quote(hostname)}"

    result = await session.run(cmd)
    if result.exit_code != 0 or not result.stdout.strip():
        return _failed(
            f"DNS resolution failed for {hostname} ({record_type})",
            exit_code=result.exit_code,
            stdout=result.stdout,
            stderr=result.stderr,
            duration_ms=result.duration_ms,
        )

    resolved_ips = set()
    for line in result.stdout.splitlines():
        parts = line.split()
        if parts:
            resolved_ips.add(parts[0])

    if expect_ip is not None and str(expect_ip) not in resolved_ips:
        return _failed(
            f"{hostname} resolved to {sorted(resolved_ips)}, expected {expect_ip}",
            exit_code=result.exit_code,
            stdout=result.stdout,
            duration_ms=result.duration_ms,
        )
    return _passed(
        f"{hostname} → {', '.join(sorted(resolved_ips))}",
        exit_code=result.exit_code,
        stdout=result.stdout,
        duration_ms=result.duration_ms,
    )


_NUMERIC_OPS: dict[str, Callable[[float, float], bool]] = {
    "==": lambda a, b: a == b,
    "!=": lambda a, b: a != b,
    ">": lambda a, b: a > b,
    ">=": lambda a, b: a >= b,
    "<": lambda a, b: a < b,
    "<=": lambda a, b: a <= b,
}


@register(CheckKind.COMMAND_OUTPUT_COMPARE)
async def _command_output_compare(spec: CheckSpec, session: SshSession) -> CheckOutcome:
    cmd = str(_required_param(spec, "cmd"))
    operator = str(_required_param(spec, "operator"))
    expected_value = _required_param(spec, "value")

    if operator not in _NUMERIC_OPS:
        return _errored(f"unsupported operator {operator!r}; allowed: {list(_NUMERIC_OPS)}")
    try:
        expected_num = float(expected_value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return _errored(f"expected value must be numeric, got {expected_value!r}")

    result = await session.run(cmd)
    if result.exit_code != 0:
        return _failed(
            f"command exited {result.exit_code} before comparison",
            exit_code=result.exit_code,
            stdout=result.stdout,
            stderr=result.stderr,
            duration_ms=result.duration_ms,
        )

    raw = result.stdout.strip().splitlines()
    if not raw:
        return _failed(
            "command produced empty output",
            exit_code=result.exit_code,
            duration_ms=result.duration_ms,
        )
    last_token = raw[-1].split()
    candidate = last_token[-1] if last_token else raw[-1]
    try:
        actual_num = float(candidate)
    except ValueError:
        return _failed(
            f"cannot parse {candidate!r} as number",
            exit_code=result.exit_code,
            stdout=result.stdout,
            duration_ms=result.duration_ms,
        )

    op_fn = _NUMERIC_OPS[operator]
    if op_fn(actual_num, expected_num):
        return _passed(
            f"value {actual_num} {operator} {expected_num}",
            exit_code=result.exit_code,
            stdout=result.stdout,
            duration_ms=result.duration_ms,
        )
    return _failed(
        f"comparison failed: {actual_num} {operator} {expected_num} is false",
        exit_code=result.exit_code,
        stdout=result.stdout,
        duration_ms=result.duration_ms,
    )

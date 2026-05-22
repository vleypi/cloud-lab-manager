from pathlib import Path
from typing import Any, Literal

import yaml
from pydantic import BaseModel, ConfigDict, Field, ValidationError, field_validator

from app.config import get_settings
from app.core.exceptions import OrchestratorError
from app.inspector.types import (
    CheckKind,
    CheckSection,
    CheckSeverity,
    CheckSpec,
    CheckTemplate,
    default_section_for,
)


class TemplateError(OrchestratorError):
    http_status = 422
    code = "template_error"


def _templates_dir() -> Path:
    return Path(get_settings().check_templates_dir)


class _BaseCheck(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str | None = None
    type: str
    section: CheckSection | None = None
    severity: CheckSeverity = CheckSeverity.CRITICAL


class _PackageInstalled(_BaseCheck):
    type: Literal["package_installed"]
    package: str
    manager: Literal["dpkg", "apt", "rpm", "dnf", "yum"] | None = None


class _SystemdActive(_BaseCheck):
    type: Literal["systemd_active"]
    unit: str


class _PortListening(_BaseCheck):
    type: Literal["port_listening"]
    port: int = Field(ge=1, le=65535)
    protocol: Literal["tcp", "udp"] = "tcp"


class _FileExists(_BaseCheck):
    type: Literal["file_exists"]
    path: str


class _FileContains(_BaseCheck):
    type: Literal["file_contains"]
    path: str
    pattern: str


class _CommandExitZero(_BaseCheck):
    type: Literal["command_exit_zero"]
    cmd: str


class _CommandOutputMatches(_BaseCheck):
    type: Literal["command_output_matches"]
    cmd: str
    pattern: str


class _OsRelease(_BaseCheck):
    type: Literal["os_release"]
    id: str | None = None
    version: str | None = None
    version_id: str | None = None
    id_like: str | None = None


class _UserExists(_BaseCheck):
    type: Literal["user_exists"]
    username: str
    groups: list[str] = Field(default_factory=list)
    shell: str | None = None
    uid: int | None = None


class _ProcessRunning(_BaseCheck):
    type: Literal["process_running"]
    name: str
    min_count: int = Field(default=1, ge=1)
    full_cmdline: bool = False


class _HttpEndpoint(_BaseCheck):
    type: Literal["http_endpoint"]
    url: str
    method: Literal["GET", "POST", "PUT", "DELETE", "HEAD", "OPTIONS"] = "GET"
    expect_status: int | None = Field(default=None, ge=100, le=599)
    expect_body_contains: str | None = None
    expect_header_matches: str | None = None
    timeout_seconds: int = Field(default=10, ge=1, le=60)


class _DnsResolves(_BaseCheck):
    type: Literal["dns_resolves"]
    hostname: str
    expect_ip: str | None = None
    record_type: Literal["A", "AAAA", "MX", "TXT", "CNAME"] = "A"


class _CommandOutputCompare(_BaseCheck):
    type: Literal["command_output_compare"]
    cmd: str
    operator: Literal["==", "!=", ">", ">=", "<", "<="]
    value: float


_CHECK_MODEL_BY_KIND: dict[CheckKind, type[_BaseCheck]] = {
    CheckKind.PACKAGE_INSTALLED: _PackageInstalled,
    CheckKind.SYSTEMD_ACTIVE: _SystemdActive,
    CheckKind.PORT_LISTENING: _PortListening,
    CheckKind.FILE_EXISTS: _FileExists,
    CheckKind.FILE_CONTAINS: _FileContains,
    CheckKind.COMMAND_EXIT_ZERO: _CommandExitZero,
    CheckKind.COMMAND_OUTPUT_MATCHES: _CommandOutputMatches,
    CheckKind.OS_RELEASE: _OsRelease,
    CheckKind.USER_EXISTS: _UserExists,
    CheckKind.PROCESS_RUNNING: _ProcessRunning,
    CheckKind.HTTP_ENDPOINT: _HttpEndpoint,
    CheckKind.DNS_RESOLVES: _DnsResolves,
    CheckKind.COMMAND_OUTPUT_COMPARE: _CommandOutputCompare,
}


class _TemplateDocument(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str | None = None
    version: str | int | float | None = None
    description: str | None = None
    checks: list[dict[str, Any]]

    @field_validator("checks")
    @classmethod
    def _non_empty(cls, v: list[dict[str, Any]]) -> list[dict[str, Any]]:
        if not v:
            raise ValueError("Template must contain at least one check")
        return v


def list_templates() -> list[dict[str, str | None]]:
    out: list[dict[str, str | None]] = []
    directory = _templates_dir()
    if not directory.is_dir():
        return out
    for path in sorted(directory.iterdir()):
        if path.suffix.lower() not in {".yaml", ".yml"}:
            continue
        try:
            raw = yaml.safe_load(path.read_text(encoding="utf-8"))
        except yaml.YAMLError:
            continue
        if not isinstance(raw, dict):
            continue
        template_name = path.stem
        checks = raw.get("checks") or []
        out.append(
            {
                "name": template_name,
                "display_name": str(raw.get("name") or template_name),
                "description": (str(raw["description"]) if raw.get("description") else None),
                "version": str(raw["version"]) if raw.get("version") else None,
                "checks_count": str(len(checks)) if isinstance(checks, list) else "0",
            }
        )
    return out


def _parse_check(template_name: str, index: int, entry: dict[str, Any]) -> CheckSpec:
    type_raw = entry.get("type")
    if not type_raw:
        raise TemplateError(
            f"Check #{index}: missing 'type' field",
            details={"template_name": template_name, "index": index},
        )
    try:
        kind = CheckKind(type_raw)
    except ValueError as exc:
        raise TemplateError(
            f"Check #{index}: unknown type {type_raw!r}",
            details={
                "template_name": template_name,
                "index": index,
                "allowed_types": [k.value for k in CheckKind],
            },
        ) from exc

    model_cls = _CHECK_MODEL_BY_KIND[kind]
    try:
        parsed = model_cls.model_validate(entry)
    except ValidationError as exc:
        errors = [
            {
                "loc": ".".join(str(p) for p in err["loc"]),
                "msg": err["msg"],
                "type": err["type"],
            }
            for err in exc.errors()
        ]
        raise TemplateError(
            f"Check #{index} ({kind.value}) failed validation",
            details={
                "template_name": template_name,
                "index": index,
                "kind": kind.value,
                "errors": errors,
            },
        ) from exc

    params: dict[str, Any] = parsed.model_dump(
        exclude={"name", "type", "section", "severity"},
        exclude_none=True,
    )
    section = parsed.section if parsed.section is not None else default_section_for(kind)
    return CheckSpec(
        name=parsed.name or f"{kind.value} #{index}",
        kind=kind,
        params=params,
        section=section,
        severity=parsed.severity,
    )


def load(template_name: str) -> CheckTemplate:
    if "/" in template_name or "\\" in template_name or ".." in template_name:
        raise TemplateError(
            "Invalid template name",
            details={"template_name": template_name},
        )

    path = _templates_dir() / f"{template_name}.yaml"
    if not path.exists():
        path = _templates_dir() / f"{template_name}.yml"
    if not path.exists():
        raise TemplateError(
            "Check template not found",
            details={"template_name": template_name, "search_dir": str(_templates_dir())},
        )

    try:
        raw = yaml.safe_load(path.read_text(encoding="utf-8"))
    except yaml.YAMLError as exc:
        raise TemplateError(
            "Check template is not valid YAML",
            details={"template_name": template_name, "error": str(exc)},
        ) from exc

    if not isinstance(raw, dict):
        raise TemplateError(
            "Template root must be a mapping",
            details={"template_name": template_name},
        )

    try:
        doc = _TemplateDocument.model_validate(raw)
    except ValidationError as exc:
        errors = [
            {"loc": ".".join(str(p) for p in err["loc"]), "msg": err["msg"]} for err in exc.errors()
        ]
        raise TemplateError(
            "Template document failed validation",
            details={"template_name": template_name, "errors": errors},
        ) from exc

    checks: list[CheckSpec] = []
    for i, entry in enumerate(doc.checks):
        checks.append(_parse_check(template_name, i, entry))

    return CheckTemplate(
        name=doc.name or template_name,
        version=str(doc.version) if doc.version is not None else None,
        description=doc.description,
        checks=checks,
    )

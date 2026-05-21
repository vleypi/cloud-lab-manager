from pathlib import Path
from typing import Any

import yaml

from app.config import get_settings
from app.core.exceptions import OrchestratorError
from app.inspector.types import CheckKind, CheckSpec, CheckTemplate


class TemplateError(OrchestratorError):
    http_status = 422
    code = "template_error"


def _templates_dir() -> Path:
    return Path(get_settings().check_templates_dir)


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
                "description": (
                    str(raw["description"]) if raw.get("description") else None
                ),
                "version": str(raw["version"]) if raw.get("version") else None,
                "checks_count": str(len(checks)) if isinstance(checks, list) else "0",
            }
        )
    return out


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

    name = raw.get("name") or template_name
    version = raw.get("version")
    description = raw.get("description")

    checks_raw = raw.get("checks", [])
    if not isinstance(checks_raw, list) or not checks_raw:
        raise TemplateError(
            "Template has no checks",
            details={"template_name": template_name},
        )

    checks: list[CheckSpec] = []
    for i, entry in enumerate(checks_raw):
        if not isinstance(entry, dict):
            raise TemplateError(
                f"Check #{i} must be a mapping",
                details={"template_name": template_name, "index": i},
            )
        try:
            kind = CheckKind(entry["type"])
        except (KeyError, ValueError) as exc:
            raise TemplateError(
                f"Unknown / missing check type at #{i}",
                details={"template_name": template_name, "entry": entry},
            ) from exc
        params: dict[str, Any] = {
            k: v for k, v in entry.items() if k not in {"name", "type"}
        }
        checks.append(
            CheckSpec(
                name=str(entry.get("name") or f"{kind.value} #{i}"),
                kind=kind,
                params=params,
            )
        )

    return CheckTemplate(
        name=name,
        version=str(version) if version is not None else None,
        description=description,
        checks=checks,
    )

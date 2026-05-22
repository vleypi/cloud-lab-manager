import pathlib
import sys

import yaml

REQUIRED_FIELDS = ("ki_project_id", "ki_project_name", "ki_domain_id", "ki_domain_name")
PLACEHOLDER_MARKER = "REPLACE"


def main() -> int:
    path = pathlib.Path("config/pool.yaml")
    if not path.exists():
        print("config/pool.yaml not found. Run `make pool-init`.", file=sys.stderr)
        return 1

    try:
        data = yaml.safe_load(path.read_text(encoding="utf-8"))
    except yaml.YAMLError as exc:
        print(f"Invalid YAML in config/pool.yaml: {exc}", file=sys.stderr)
        return 1

    if not isinstance(data, list):
        print("config/pool.yaml: top-level must be a YAML list of entries.", file=sys.stderr)
        return 1

    if not data:
        print("config/pool.yaml: file is empty — no projects will be available.", file=sys.stderr)
        return 1

    errors: list[str] = []
    seen_ids: dict[str, int] = {}

    for i, entry in enumerate(data):
        if not isinstance(entry, dict):
            errors.append(f"entry #{i}: must be a YAML mapping, got {type(entry).__name__}")
            continue
        for field in REQUIRED_FIELDS:
            value = entry.get(field)
            if not value:
                errors.append(f"entry #{i}: missing required field {field!r}")
                continue
            if isinstance(value, str) and PLACEHOLDER_MARKER in value:
                errors.append(
                    f"entry #{i}: {field}={value!r} still contains placeholder text — "
                    "replace it with the real KI UUID"
                )
        pid = entry.get("ki_project_id")
        if isinstance(pid, str):
            if pid in seen_ids:
                errors.append(
                    f"entry #{i}: ki_project_id={pid!r} duplicates entry #{seen_ids[pid]}"
                )
            else:
                seen_ids[pid] = i

    if errors:
        print("\n".join(errors), file=sys.stderr)
        return 1

    print(f"[ok] config/pool.yaml: {len(data)} entries, all required fields present.")
    return 0


if __name__ == "__main__":
    sys.exit(main())

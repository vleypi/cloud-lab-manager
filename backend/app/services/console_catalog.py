from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Literal

import yaml

ConsoleProtocol = Literal["ssh", "vnc", "rdp"]


@dataclass(slots=True, frozen=True)
class ConsoleProfile:
    protocol: ConsoleProtocol
    username: str | None
    port: int

    def to_dict(self) -> dict:
        return {
            "protocol": self.protocol,
            "username": self.username,
            "port": self.port,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "ConsoleProfile":
        proto = (data.get("protocol") or "ssh").lower()
        if proto not in ("ssh", "vnc", "rdp"):
            proto = "ssh"
        return cls(
            protocol=proto,  # type: ignore[arg-type]
            username=data.get("username"),
            port=int(data.get("port") or _default_port(proto)),
        )


def _default_port(protocol: str) -> int:
    return {"ssh": 22, "vnc": 5901, "rdp": 3389}.get(protocol, 22)


def _default_profile() -> ConsoleProfile:
    return ConsoleProfile(protocol="ssh", username="ubuntu", port=22)


_CATALOG_PATHS = (
    Path("config/console_catalog.yaml"),
    Path("config/console_catalog.example.yaml"),
    Path("/app/config/console_catalog.yaml"),
    Path("/app/config/console_catalog.example.yaml"),
)


@lru_cache(maxsize=1)
def _load_catalog() -> tuple[ConsoleProfile, dict[str, ConsoleProfile]]:
    raw: dict = {}
    for p in _CATALOG_PATHS:
        if p.exists():
            with p.open("r", encoding="utf-8") as f:
                raw = yaml.safe_load(f) or {}
            break

    default = (
        ConsoleProfile.from_dict(raw["default"])
        if isinstance(raw.get("default"), dict)
        else _default_profile()
    )

    by_image: dict[str, ConsoleProfile] = {}
    for item in raw.get("images") or []:
        if not isinstance(item, dict):
            continue
        image_id = str(item.get("image_id") or "").strip()
        if not image_id:
            continue
        by_image[image_id] = ConsoleProfile.from_dict(item)
    return default, by_image


def resolve_console_profile(image_id: str) -> ConsoleProfile:
    default, by_image = _load_catalog()
    if image_id in by_image:
        return by_image[image_id]
    return default


def reset_catalog_cache() -> None:
    _load_catalog.cache_clear()

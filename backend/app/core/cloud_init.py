from functools import lru_cache
from pathlib import Path

from app.config import get_settings


@lru_cache(maxsize=1)
def inspector_public_key() -> str | None:
    path = Path(get_settings().inspector_ssh_public_key_path)
    if not path.exists():
        return None
    return path.read_text(encoding="utf-8").strip()


def build_user_data(*, extra_authorized_keys: list[str] | None = None) -> str | None:
    pub = inspector_public_key()
    if not pub:
        return None

    settings = get_settings()
    keys = [pub, *(extra_authorized_keys or [])]
    keys_block = "\n".join(f"      - {k}" for k in keys)

    return f"""#cloud-config
users:
  - name: {settings.inspector_ssh_username}
    lock_passwd: true
    shell: /bin/bash
    sudo: 'ALL=(ALL) NOPASSWD: /bin/systemctl is-active *, /bin/systemctl status *, /usr/bin/ss -tln, /usr/bin/ss -tlnp, /bin/cat /etc/*, /usr/bin/dpkg -s *, /usr/bin/rpm -q *'
    ssh_authorized_keys:
{keys_block}
"""

from functools import lru_cache
from pathlib import Path

from app.config import get_settings


@lru_cache(maxsize=1)
def inspector_public_key() -> str | None:
    path = Path(get_settings().inspector_ssh_public_key_path)
    if not path.exists():
        return None
    return path.read_text(encoding="utf-8").strip()


def build_user_data(
    *,
    extra_authorized_keys: list[str] | None = None,
    console_user: str | None = None,
    console_password: str | None = None,
) -> str | None:
    pub = inspector_public_key()
    if not pub and not console_password:
        return None

    settings = get_settings()
    sections: list[str] = ["#cloud-config"]
    users: list[str] = []

    if pub:
        keys = [pub, *(extra_authorized_keys or [])]
        keys_block = "\n".join(f"      - {k}" for k in keys)
        users.append(
            f"""  - name: {settings.inspector_ssh_username}
    lock_passwd: true
    shell: /bin/bash
    sudo: 'ALL=(ALL) NOPASSWD: /bin/systemctl is-active *, /bin/systemctl status *, /usr/bin/ss -tln, /usr/bin/ss -tlnp, /bin/cat /etc/*, /usr/bin/dpkg -s *, /usr/bin/rpm -q *'
    ssh_authorized_keys:
{keys_block}"""
        )

    if console_user and console_password:
        users.append(
            f"""  - name: {console_user}
    lock_passwd: false
    shell: /bin/bash
    sudo: 'ALL=(ALL) NOPASSWD:ALL'
    plain_text_passwd: '{console_password}'"""
        )

    if users:
        sections.append("users:")
        sections.append("\n".join(users))

    if console_password:
        sections.append(
            f"""chpasswd:
  expire: false
  list: |
    {console_user or 'student'}:{console_password}
ssh_pwauth: true"""
        )

    return "\n".join(sections) + "\n"

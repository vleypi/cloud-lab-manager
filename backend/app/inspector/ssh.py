import asyncio
import time
from dataclasses import dataclass
from pathlib import Path

import asyncssh
import structlog

from app.config import get_settings

logger = structlog.get_logger(__name__)


@dataclass(slots=True)
class CommandResult:
    stdout: str
    stderr: str
    exit_code: int
    duration_ms: int


class SshSession:
    def __init__(self, conn: asyncssh.SSHClientConnection) -> None:
        self._conn = conn

    async def run(self, cmd: str, *, timeout: float | None = None) -> CommandResult:
        settings = get_settings()
        effective_timeout = (
            timeout if timeout is not None else settings.inspector_command_timeout_seconds
        )
        started = time.monotonic()
        try:
            result = await asyncio.wait_for(
                self._conn.run(cmd, check=False), timeout=effective_timeout
            )
        except TimeoutError:
            duration_ms = int((time.monotonic() - started) * 1000)
            return CommandResult(
                stdout="",
                stderr=f"command timed out after {effective_timeout}s",
                exit_code=124,
                duration_ms=duration_ms,
            )
        duration_ms = int((time.monotonic() - started) * 1000)
        return CommandResult(
            stdout=(result.stdout or "").rstrip(),
            stderr=(result.stderr or "").rstrip(),
            exit_code=int(result.exit_status if result.exit_status is not None else 1),
            duration_ms=duration_ms,
        )

    async def close(self) -> None:
        self._conn.close()
        await self._conn.wait_closed()


async def connect(host: str) -> SshSession:
    settings = get_settings()
    key_path = Path(settings.inspector_ssh_private_key_path)
    if not key_path.exists():
        raise FileNotFoundError(
            f"Inspector SSH private key not found: {key_path}. "
            "Generate it once (ssh-keygen -t ed25519 -f secrets/inspector_ed25519 -N '') "
            "and re-deploy stands so cloud-init injects the matching public key."
        )

    conn = await asyncio.wait_for(
        asyncssh.connect(
            host,
            port=settings.inspector_ssh_port,
            username=settings.inspector_ssh_username,
            client_keys=[str(key_path)],
            known_hosts=None,
            keepalive_interval=10,
        ),
        timeout=settings.inspector_ssh_connect_timeout_seconds,
    )
    return SshSession(conn)

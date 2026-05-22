import asyncio
from typing import Iterable

import structlog
from fastapi import WebSocket
from fastapi.websockets import WebSocketState

from app.config import get_settings
from app.services.console_session import GuacdConnection

logger = structlog.get_logger(__name__)


_SUPPORTED_HANDSHAKE_ARGS: dict[str, tuple[str, ...]] = {
    "ssh": (
        "hostname",
        "port",
        "username",
        "password",
        "private-key",
        "passphrase",
        "font-name",
        "font-size",
        "enable-sftp",
        "color-scheme",
        "command",
    ),
    "vnc": (
        "hostname",
        "port",
        "password",
        "color-depth",
        "swap-red-blue",
        "cursor",
        "read-only",
        "encodings",
        "username",
    ),
    "rdp": (
        "hostname",
        "port",
        "username",
        "password",
        "domain",
        "security",
        "ignore-cert",
        "disable-auth",
        "console",
        "width",
        "height",
        "dpi",
        "color-depth",
        "resize-method",
        "enable-wallpaper",
        "enable-theming",
        "enable-font-smoothing",
        "enable-full-window-drag",
        "enable-desktop-composition",
        "enable-menu-animations",
    ),
}


def _encode_instruction(elements: Iterable[str]) -> bytes:
    parts: list[str] = []
    for el in elements:
        s = "" if el is None else str(el)
        parts.append(f"{len(s)}.{s}")
    return (",".join(parts) + ";").encode("utf-8")


class _InstructionParser:
    def __init__(self) -> None:
        self._buf = ""

    def feed(self, data: str) -> list[list[str]]:
        self._buf += data
        out: list[list[str]] = []
        while True:
            inst, rest = self._try_parse(self._buf)
            if inst is None:
                break
            out.append(inst)
            self._buf = rest
        return out

    @staticmethod
    def _try_parse(buf: str) -> tuple[list[str] | None, str]:
        i = 0
        elements: list[str] = []
        while True:
            dot = buf.find(".", i)
            if dot < 0:
                return None, buf
            try:
                length = int(buf[i:dot])
            except ValueError:
                return None, buf
            start = dot + 1
            end = start + length
            if end > len(buf):
                return None, buf
            elements.append(buf[start:end])
            sep = buf[end : end + 1]
            if sep == ",":
                i = end + 1
                continue
            if sep == ";":
                return elements, buf[end + 1 :]
            if sep == "":
                return None, buf
            return None, buf[end + 1 :]


class GuacdBridge:
    def __init__(
        self,
        websocket: WebSocket,
        connection: GuacdConnection,
    ) -> None:
        self._ws = websocket
        self._conn = connection
        self._settings = get_settings()
        self._reader: asyncio.StreamReader | None = None
        self._writer: asyncio.StreamWriter | None = None
        self._bytes_in = 0
        self._bytes_out = 0

    @property
    def bytes_in(self) -> int:
        return self._bytes_in

    @property
    def bytes_out(self) -> int:
        return self._bytes_out

    async def run(self) -> None:
        await self._open_guacd()
        try:
            await self._handshake()
            await self._proxy()
        finally:
            await self._close_guacd()

    async def _open_guacd(self) -> None:
        host = self._settings.guacd_host
        port = self._settings.guacd_port
        try:
            self._reader, self._writer = await asyncio.wait_for(
                asyncio.open_connection(host, port),
                timeout=10,
            )
        except (OSError, asyncio.TimeoutError) as exc:
            raise GuacdConnectError(f"cannot connect to guacd {host}:{port}: {exc}") from exc

    async def _close_guacd(self) -> None:
        if self._writer is not None:
            try:
                self._writer.close()
                await self._writer.wait_closed()
            except Exception:
                pass

    async def _handshake(self) -> None:
        assert self._reader is not None
        assert self._writer is not None

        proto = self._conn.protocol
        await self._send_to_guacd(_encode_instruction(["select", proto]))

        parser = _InstructionParser()
        args_inst = await self._read_next_instruction(parser)
        if not args_inst or args_inst[0] != "args":
            raise GuacdHandshakeError(f"expected 'args', got {args_inst}")
        expected_args = args_inst[1:]

        await self._send_to_guacd(
            _encode_instruction(
                ["size", str(self._conn.width), str(self._conn.height), str(self._conn.dpi)]
            )
        )
        await self._send_to_guacd(_encode_instruction(["audio", "audio/L16"]))
        await self._send_to_guacd(_encode_instruction(["video"]))
        await self._send_to_guacd(_encode_instruction(["image", "image/png", "image/jpeg"]))

        params = self._conn.to_handshake_params()
        params.setdefault("width", str(self._conn.width))
        params.setdefault("height", str(self._conn.height))
        params.setdefault("dpi", str(self._conn.dpi))

        connect_values: list[str] = ["connect"]
        for name in expected_args:
            connect_values.append(params.get(name, ""))
        await self._send_to_guacd(_encode_instruction(connect_values))

    async def _read_next_instruction(self, parser: _InstructionParser) -> list[str] | None:
        assert self._reader is not None
        while True:
            chunk = await asyncio.wait_for(self._reader.read(4096), timeout=15)
            if not chunk:
                return None
            text = chunk.decode("utf-8", errors="replace")
            parsed = parser.feed(text)
            if parsed:
                return parsed[0]

    async def _proxy(self) -> None:
        ws_to_tcp = asyncio.create_task(self._pump_ws_to_tcp())
        tcp_to_ws = asyncio.create_task(self._pump_tcp_to_ws())
        done, pending = await asyncio.wait(
            {ws_to_tcp, tcp_to_ws},
            return_when=asyncio.FIRST_COMPLETED,
        )
        for t in pending:
            t.cancel()
        for t in done:
            exc = t.exception()
            if exc and not isinstance(exc, (asyncio.CancelledError,)):
                logger.warning("console_proxy_task_error", error=str(exc))

    async def _pump_ws_to_tcp(self) -> None:
        assert self._writer is not None
        try:
            while True:
                msg = await self._ws.receive_text()
                self._bytes_in += len(msg)
                self._writer.write(msg.encode("utf-8"))
                await self._writer.drain()
        except Exception:
            return

    async def _pump_tcp_to_ws(self) -> None:
        assert self._reader is not None
        try:
            while True:
                chunk = await self._reader.read(4096)
                if not chunk:
                    return
                self._bytes_out += len(chunk)
                if self._ws.client_state != WebSocketState.CONNECTED:
                    return
                await self._ws.send_text(chunk.decode("utf-8", errors="replace"))
        except Exception:
            return

    async def _send_to_guacd(self, data: bytes) -> None:
        assert self._writer is not None
        self._writer.write(data)
        await self._writer.drain()


class GuacdError(Exception):
    pass


class GuacdConnectError(GuacdError):
    pass


class GuacdHandshakeError(GuacdError):
    pass

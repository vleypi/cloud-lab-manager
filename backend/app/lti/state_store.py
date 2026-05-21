import json
import secrets
from dataclasses import asdict, dataclass

import redis.asyncio as redis_async

from app.config import get_settings


@dataclass(slots=True)
class LaunchState:
    state: str
    nonce: str
    platform_id: str
    client_id: str
    login_hint: str
    lti_message_hint: str | None
    target_link_uri: str


def _key(state: str) -> str:
    return f"lti:launch-state:{state}"


def generate_state() -> str:
    return secrets.token_urlsafe(32)


def generate_nonce() -> str:
    return secrets.token_urlsafe(24)


class LaunchStateStore:
    def __init__(self) -> None:
        settings = get_settings()
        self._client = redis_async.from_url(settings.redis_url, decode_responses=True)
        self._ttl = settings.lti_launch_state_ttl_seconds

    async def put(self, state: LaunchState) -> None:
        await self._client.set(_key(state.state), json.dumps(asdict(state)), ex=self._ttl)

    async def pop(self, state: str) -> LaunchState | None:
        raw = await self._client.getdel(_key(state))
        if raw is None:
            return None
        return LaunchState(**json.loads(raw))

    async def close(self) -> None:
        await self._client.aclose()

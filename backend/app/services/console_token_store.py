import secrets

import redis.asyncio as redis_async

from app.config import get_settings


def _key(token: str) -> str:
    return f"ki:console-token:{token}"


class ConsoleTokenStore:
    def __init__(self) -> None:
        settings = get_settings()
        self._client: redis_async.Redis = redis_async.from_url(
            settings.redis_url, decode_responses=True
        )
        self._ttl = settings.console_token_ttl_seconds

    async def issue(self, *, stand_id: str, user_id: str) -> tuple[str, int]:
        token = secrets.token_urlsafe(24)
        payload = f"{user_id}:{stand_id}"
        await self._client.set(_key(token), payload, ex=self._ttl)
        return token, self._ttl

    async def consume(self, token: str) -> tuple[str, str] | None:
        raw = await self._client.get(_key(token))
        if raw is None:
            return None
        await self._client.delete(_key(token))
        try:
            user_id, stand_id = raw.split(":", 1)
        except ValueError:
            return None
        return user_id, stand_id

    async def close(self) -> None:
        await self._client.aclose()

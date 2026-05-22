import json
from dataclasses import asdict, dataclass, fields

import redis.asyncio as redis_async
import redis as redis_sync

from app.config import get_settings


@dataclass(slots=True, frozen=True)
class StandCredentials:
    ssh_public_key: str
    ssh_private_key: str
    fingerprint: str
    keypair_name: str
    console_password: str | None = None

    @classmethod
    def from_json(cls, raw: str) -> "StandCredentials":
        data = json.loads(raw)
        allowed = {f.name for f in fields(cls)}
        filtered = {k: v for k, v in data.items() if k in allowed}
        return cls(**filtered)

    def to_json(self) -> str:
        return json.dumps(asdict(self))


def _key(stand_id: str) -> str:
    return f"ki:stand-credentials:{stand_id}"


class CredentialsStore:
    def __init__(self) -> None:
        settings = get_settings()
        self._client: redis_async.Redis = redis_async.from_url(
            settings.redis_url, decode_responses=True
        )
        self._ttl = settings.credentials_ttl_seconds

    async def get(self, stand_id: str) -> StandCredentials | None:
        raw = await self._client.get(_key(stand_id))
        if raw is None:
            return None
        return StandCredentials.from_json(raw)

    async def refresh_ttl(self, stand_id: str, ttl_seconds: int) -> bool:
        return bool(await self._client.expire(_key(stand_id), ttl_seconds))

    async def put(self, stand_id: str, creds: StandCredentials) -> None:
        await self._client.set(_key(stand_id), creds.to_json(), ex=self._ttl)

    async def delete(self, stand_id: str) -> None:
        await self._client.delete(_key(stand_id))

    async def close(self) -> None:
        await self._client.aclose()


class SyncCredentialsStore:
    def __init__(self) -> None:
        settings = get_settings()
        self._client: redis_sync.Redis = redis_sync.from_url(
            settings.redis_url, decode_responses=True
        )
        self._ttl = settings.credentials_ttl_seconds

    def put(self, stand_id: str, creds: StandCredentials) -> None:
        self._client.set(_key(stand_id), creds.to_json(), ex=self._ttl)

    def delete(self, stand_id: str) -> None:
        self._client.delete(_key(stand_id))

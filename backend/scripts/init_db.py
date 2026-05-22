from __future__ import annotations

import asyncio
import json
import os
from pathlib import Path
from typing import Any

import structlog
from sqlalchemy import select

from app.db.base import Base
from app.db.session import AsyncSessionLocal, sync_engine
from app.models import ( 
    CapacityRejection,
    CheckResult,
    CheckRun,
    CourseMapping,
    LifecycleSettingChange,
    LtiPlatform,
    LtiUser,
    PendingLtiBinding,
    PoolProject,
    ProjectStatus,
    RuntimeSetting,
    Stand,
    User,
)

logger = structlog.get_logger(__name__)

POOL_SEED_PATH = os.environ.get("POOL_SEED_PATH", "/app/pool.yaml")


def create_schema() -> None:
    Base.metadata.create_all(sync_engine, checkfirst=True)
    logger.info("schema_ready")


def _load_pool_entries(path: Path) -> list[dict[str, Any]]:
    raw = path.read_text(encoding="utf-8")
    if path.suffix.lower() in {".yaml", ".yml"}:
        import yaml

        data = yaml.safe_load(raw)
    else:
        data = json.loads(raw)
    if not isinstance(data, list):
        raise ValueError("pool seed file must be a list of entries")
    return data


async def _seed_pool(path: Path) -> None:
    entries = _load_pool_entries(path)
    if not entries:
        logger.info("pool_seed_empty_file", path=str(path))
        return

    expected_ids = {entry["ki_project_id"] for entry in entries}

    async with AsyncSessionLocal() as session:
        for entry in entries:
            ki_project_id = entry["ki_project_id"]
            existing = (
                await session.execute(
                    select(PoolProject).where(PoolProject.ki_project_id == ki_project_id)
                )
            ).scalar_one_or_none()
            if existing is None:
                session.add(
                    PoolProject(
                        ki_project_id=ki_project_id,
                        ki_project_name=entry["ki_project_name"],
                        ki_domain_id=entry["ki_domain_id"],
                        ki_domain_name=entry["ki_domain_name"],
                        ki_network_id=entry.get("ki_network_id"),
                        ki_router_id=entry.get("ki_router_id"),
                        status=ProjectStatus(entry.get("status", "free")),
                    )
                )
                logger.info("pool_project_added", name=entry["ki_project_name"])
            else:
                existing.ki_project_name = entry["ki_project_name"]
                existing.ki_domain_id = entry["ki_domain_id"]
                existing.ki_domain_name = entry["ki_domain_name"]
                existing.ki_network_id = entry.get("ki_network_id")
                existing.ki_router_id = entry.get("ki_router_id")
                logger.info("pool_project_updated", name=entry["ki_project_name"])

        orphans = (
            await session.execute(
                select(PoolProject).where(
                    ~PoolProject.ki_project_id.in_(expected_ids),
                )
            )
        ).scalars().all()
        for orphan in orphans:
            linked_stands = (
                await session.execute(
                    select(Stand).where(Stand.pool_project_id == orphan.id)
                )
            ).scalars().all()
            for s in linked_stands:
                logger.warning(
                    "stand_removed_with_orphan_project",
                    stand_id=str(s.id),
                    status=s.status.value if s.status else None,
                    pool_project_id=str(orphan.id),
                )
                await session.delete(s)
            if linked_stands:
                await session.flush()

            if orphan.status == ProjectStatus.ALLOCATED:
                logger.warning(
                    "pool_project_orphan_was_allocated_force_freed",
                    ki_project_id=orphan.ki_project_id,
                )
            logger.warning(
                "pool_project_orphan_removed",
                ki_project_id=orphan.ki_project_id,
                ki_project_name=orphan.ki_project_name,
                reason="not in pool.yaml",
            )
            await session.delete(orphan)
            await session.flush()

        await session.commit()


def seed_pool_if_available() -> None:
    path = Path(POOL_SEED_PATH)
    if not path.is_file():
        logger.info("pool_seed_skipped", reason="file_not_found", path=str(path))
        return
    asyncio.run(_seed_pool(path))


def main() -> None:
    create_schema()
    seed_pool_if_available()


if __name__ == "__main__":
    main()

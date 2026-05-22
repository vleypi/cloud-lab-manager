from uuid import UUID

import structlog
from fastapi import APIRouter, Depends, HTTPException, Path, Query, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import cloud_provider, db_session, pool_manager
from app.models.project import PoolProject, ProjectStatus
from app.models.stand import Stand, StandStatus
from app.providers import CloudProvider

logger = structlog.get_logger(__name__)

_ACTIVE_STAND_STATUSES = frozenset(
    {
        StandStatus.ALLOCATING,
        StandStatus.DEPLOYING,
        StandStatus.READY,
        StandStatus.FROZEN,
        StandStatus.CLEANING,
    }
)
from app.schemas.capacity import PoolInventoryOut
from app.schemas.pool import (
    DiscoveredKiProject,
    PoolBulkAddIn,
    PoolBulkAddOut,
    PoolProjectIn,
    PoolProjectOut,
)
from app.services.pool_manager import PoolManager

router = APIRouter(prefix="/pool", tags=["pool"])


async def _known_project_ids(session: AsyncSession) -> set[str]:
    return set((await session.scalars(select(PoolProject.ki_project_id))).all())


def _build_project(entry: PoolProjectIn, *, ki_project_id: str | None = None) -> PoolProject:
    return PoolProject(
        ki_project_id=ki_project_id if ki_project_id is not None else entry.ki_project_id.strip(),
        ki_project_name=entry.ki_project_name.strip(),
        ki_domain_id=entry.ki_domain_id.strip(),
        ki_domain_name=entry.ki_domain_name.strip(),
        ki_network_id=(entry.ki_network_id or "").strip() or None,
        ki_router_id=(entry.ki_router_id or "").strip() or None,
        status=ProjectStatus.FREE,
    )


@router.get("/inventory", response_model=PoolInventoryOut)
async def get_inventory(
    pool: PoolManager = Depends(pool_manager),
) -> PoolInventoryOut:
    counts = await pool.inventory()
    return PoolInventoryOut(**counts)


@router.get("/projects", response_model=list[PoolProjectOut])
async def list_projects(
    session: AsyncSession = Depends(db_session),
) -> list[PoolProjectOut]:
    projects = await session.scalars(select(PoolProject).order_by(PoolProject.created_at.desc()))
    return [PoolProjectOut.from_orm_project(p) for p in projects.all()]


@router.post(
    "/projects",
    response_model=PoolProjectOut,
    status_code=status.HTTP_201_CREATED,
)
async def add_project(
    payload: PoolProjectIn,
    session: AsyncSession = Depends(db_session),
) -> PoolProjectOut:
    project = _build_project(payload)
    session.add(project)
    try:
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Project with ki_project_id={payload.ki_project_id} already in pool",
        ) from exc
    await session.refresh(project)
    return PoolProjectOut.from_orm_project(project)


@router.delete("/projects/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(
    project_id: UUID = Path(...),
    session: AsyncSession = Depends(db_session),
) -> None:
    project = await session.get(PoolProject, project_id)
    if project is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pool project not found",
        )
    if project.status == ProjectStatus.ALLOCATED:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot delete an allocated project, destroy the stand first",
        )

    linked_stands = (
        (await session.execute(select(Stand).where(Stand.pool_project_id == project_id)))
        .scalars()
        .all()
    )
    active = [s for s in linked_stands if s.status in _ACTIVE_STAND_STATUSES]
    if active:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"Cannot delete: {len(active)} active stand(s) still reference this project. "
                "Destroy them first."
            ),
        )
    for s in linked_stands:
        logger.warning(
            "stand_history_purged_with_pool_project",
            stand_id=str(s.id),
            stand_status=s.status.value if s.status else None,
            pool_project_id=str(project_id),
        )
        await session.delete(s)
    if linked_stands:
        await session.flush()

    await session.delete(project)
    await session.commit()


@router.get("/discover", response_model=list[DiscoveredKiProject])
async def discover_projects(
    domain_id: str | None = Query(default=None, description="UUID домена КИ"),
    session: AsyncSession = Depends(db_session),
    provider: CloudProvider = Depends(cloud_provider),
) -> list[DiscoveredKiProject]:
    ki_projects = await provider.list_ki_projects(domain_id=domain_id)
    known_ids = await _known_project_ids(session)

    return [
        DiscoveredKiProject(
            ki_project_id=p.id,
            ki_project_name=p.name,
            ki_domain_id=p.domain_id,
            ki_domain_name=p.domain_name,
            ki_network_id=p.network_id,
            ki_router_id=p.router_id,
            already_in_pool=p.id in known_ids,
        )
        for p in ki_projects
    ]


@router.post(
    "/projects/bulk",
    response_model=PoolBulkAddOut,
    status_code=status.HTTP_201_CREATED,
)
async def bulk_add_projects(
    payload: PoolBulkAddIn,
    session: AsyncSession = Depends(db_session),
) -> PoolBulkAddOut:
    existing = await session.execute(select(PoolProject.ki_project_id))
    known_ids = {row[0] for row in existing.all()}

    added: list[PoolProject] = []
    skipped: list[str] = []
    seen: set[str] = set()

    for entry in payload.projects:
        pid = entry.ki_project_id.strip()
        if not pid or pid in known_ids or pid in seen:
            skipped.append(pid or "<empty>")
            continue
        seen.add(pid)
        project = PoolProject(
            ki_project_id=pid,
            ki_project_name=entry.ki_project_name.strip(),
            ki_domain_id=entry.ki_domain_id.strip(),
            ki_domain_name=entry.ki_domain_name.strip(),
            ki_network_id=(entry.ki_network_id or "").strip() or None,
            ki_router_id=(entry.ki_router_id or "").strip() or None,
            status=ProjectStatus.FREE,
        )
        session.add(project)
        added.append(project)

    try:
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Bulk insert failed due to integrity constraint",
        ) from exc

    for p in added:
        await session.refresh(p)

    return PoolBulkAddOut(
        added=[PoolProjectOut.from_orm_project(p) for p in added],
        skipped=skipped,
    )

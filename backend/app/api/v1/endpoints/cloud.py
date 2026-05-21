from dataclasses import asdict

from fastapi import APIRouter, Depends

from app.api.deps import cloud_provider
from app.providers import CloudProvider

router = APIRouter(prefix="/cloud", tags=["cloud"])


@router.get("/networks")
async def list_networks(
    provider: CloudProvider = Depends(cloud_provider),
) -> list[dict]:
    nets = await provider.list_networks()
    return [asdict(n) for n in nets]


@router.get("/images")
async def list_images(
    provider: CloudProvider = Depends(cloud_provider),
) -> list[dict]:
    images = await provider.list_images()
    return [asdict(i) for i in images]


@router.get("/flavors")
async def list_flavors(
    provider: CloudProvider = Depends(cloud_provider),
) -> list[dict]:
    flavors = await provider.list_flavors()
    return [asdict(f) for f in flavors]

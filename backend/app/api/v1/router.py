from fastapi import APIRouter

from app.api.v1.endpoints import (
    admin,
    auth,
    capacity,
    cloud,
    console,
    health,
    inspector,
    integrations,
    lti,
    pool,
    stands,
)

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(capacity.router)
api_router.include_router(pool.router)
api_router.include_router(stands.router)
api_router.include_router(console.router)
api_router.include_router(inspector.router)
api_router.include_router(admin.router)
api_router.include_router(lti.router)
api_router.include_router(integrations.router)
api_router.include_router(cloud.router)

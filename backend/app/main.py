from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from app.api.v1.router import api_router
from app.config import get_settings
from app.core.exceptions import OrchestratorError
from app.core.logging import configure_logging
from app.db.session import AsyncSessionLocal
from app.services.admin_seeder import seed_super_admin

configure_logging()
logger = structlog.get_logger("app.main")


@asynccontextmanager
async def lifespan(_: FastAPI):
    settings = get_settings()
    logger.info(
        "app_start",
        env=settings.app_env,
        debug=settings.app_debug,
        capacity_threshold=settings.capacity_threshold_percent,
    )
    async with AsyncSessionLocal() as session:
        try:
            await seed_super_admin(session)
        except Exception:
            logger.exception("super_admin_seed_failed")
    yield
    logger.info("app_stop")


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="Cloud-Lab Manager",
        version="0.1.0",
        description=(
            "Шлюз управления лабораторных стендов на платформе Кибер Инфраструктура. "
            "Управляет пулом проектов, capacity guard, асинхронным деплоем VM и "
            "автоматическими SSH-проверками."
        ),
        debug=settings.app_debug,
        lifespan=lifespan,
    )

    app.include_router(api_router)

    @app.exception_handler(OrchestratorError)
    async def handle_domain_error(_: Request, exc: OrchestratorError) -> JSONResponse:
        return JSONResponse(
            status_code=exc.http_status,
            content={
                "code": exc.code,
                "message": exc.message,
                "details": exc.details or None,
            },
        )

    return app


app = create_app()

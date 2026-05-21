import logging
import sys

import structlog

from app.config import get_settings


def configure_logging() -> None:
    settings = get_settings()
    log_level = logging.DEBUG if settings.app_debug else logging.INFO

    timestamper = structlog.processors.TimeStamper(fmt="iso", utc=True)
    shared_processors: list = [
        structlog.contextvars.merge_contextvars,
        structlog.processors.add_log_level,
        timestamper,
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
    ]

    if settings.app_env == "development":
        renderer: structlog.types.Processor = structlog.dev.ConsoleRenderer(colors=False)
    else:
        renderer = structlog.processors.JSONRenderer()

    structlog.configure(
        processors=[*shared_processors, renderer],
        wrapper_class=structlog.make_filtering_bound_logger(log_level),
        context_class=dict,
        logger_factory=structlog.PrintLoggerFactory(file=sys.stdout),
        cache_logger_on_first_use=True,
    )

    logging.basicConfig(
        level=log_level,
        format="%(message)s",
        handlers=[logging.StreamHandler(sys.stdout)],
    )


def get_logger(name: str | None = None) -> structlog.stdlib.BoundLogger:
    return structlog.get_logger(name)

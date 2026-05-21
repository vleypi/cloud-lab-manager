
from celery import Celery
from celery.schedules import schedule

from app.config import get_settings


def create_celery() -> Celery:
    settings = get_settings()
    app = Celery(
        "cloud_lab_manager",
        broker=settings.celery_broker_url,
        backend=settings.celery_result_backend,
        include=["app.tasks.stands", "app.tasks.inspector"],
    )

    app.conf.update(
        task_serializer="json",
        accept_content=["json"],
        result_serializer="json",
        timezone="UTC",
        enable_utc=True,
        task_acks_late=True,
        task_reject_on_worker_lost=True,
        worker_prefetch_multiplier=1,
        task_default_queue="orchestrator",
        task_always_eager=settings.celery_task_always_eager,
        result_expires=3600,
        broker_connection_retry_on_startup=True,
    )

    app.conf.beat_schedule = {
        "sweep-expired-stands": {
            "task": "stands.sweep_expired",
            "schedule": schedule(run_every=settings.sweep_interval_seconds),
        },
    }
    return app


celery_app = create_celery()

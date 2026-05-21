import asyncio
from datetime import datetime, timezone
from uuid import UUID

import structlog
from celery import Task
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.celery_app import celery_app
from app.db.session import SyncSessionLocal
from app.inspector.loader import load as load_template
from app.inspector.runner import run_template
from app.models.check_run import (
    CheckResult,
    CheckResultStatus,
    CheckRun,
    CheckRunStatus,
)
from app.models.stand import Stand

logger = structlog.get_logger(__name__)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _pick_host(stand: Stand) -> str | None:
    if stand.ki_floating_ip:
        return stand.ki_floating_ip
    extra = stand.extra or {}
    fixed = extra.get("fixed_ips") or []
    if fixed:
        return str(fixed[0])
    return None


@celery_app.task(name="inspector.run", bind=True, acks_late=True)
def run_inspector(self: Task, run_id: str, template_name: str) -> dict:
    rid = UUID(run_id)
    with SyncSessionLocal() as session:
        run = session.execute(select(CheckRun).where(CheckRun.id == rid)).scalar_one_or_none()
        if run is None:
            logger.warning("inspector_run_missing", run_id=run_id)
            return {"status": "missing"}
        if run.status != CheckRunStatus.PENDING:
            logger.info(
                "inspector_run_skip_terminal",
                run_id=run_id,
                status=run.status.value,
            )
            return {"status": run.status.value}

        stand = session.execute(
            select(Stand).where(Stand.id == run.stand_id)
        ).scalar_one()
        host = _pick_host(stand)
        if not host:
            _finalize_error(session, run, "Stand has no reachable IP address")
            return {"status": "error"}

        run.task_id = self.request.id
        run.status = CheckRunStatus.RUNNING
        run.started_at = _now()
        session.commit()

        try:
            template = load_template(template_name)
        except Exception as exc:  # noqa: BLE001
            _finalize_error(session, run, f"Failed to load template: {exc}")
            return {"status": "error"}

        try:
            report = asyncio.run(run_template(template, host=host))
        except Exception as exc:  # noqa: BLE001
            logger.exception("inspector_run_crash", run_id=run_id)
            _finalize_error(session, run, f"Runner crashed: {exc}")
            return {"status": "error"}

        for position, (spec, outcome) in enumerate(report.outcomes):
            session.add(
                CheckResult(
                    check_run_id=run.id,
                    position=position,
                    name=spec.name,
                    kind=spec.kind.value,
                    status=CheckResultStatus(outcome.status),
                    message=outcome.message,
                    stdout=outcome.stdout,
                    stderr=outcome.stderr,
                    exit_code=outcome.exit_code,
                    duration_ms=outcome.duration_ms,
                    spec={"params": _jsonable(spec.params), "kind": spec.kind.value},
                )
            )
        run.total = report.total
        run.passed = report.passed
        run.failed = report.failed
        run.errored = report.errored
        run.finished_at = _now()
        run.status = CheckRunStatus(report.overall)
        run.summary = (
            f"{report.passed}/{report.total} passed "
            f"({report.failed} failed, {report.errored} errored)"
        )
        session.commit()
        logger.info(
            "inspector_run_persisted",
            run_id=run_id,
            status=run.status.value,
            passed=run.passed,
            failed=run.failed,
            errored=run.errored,
        )
        return {
            "status": run.status.value,
            "passed": run.passed,
            "failed": run.failed,
            "errored": run.errored,
        }


def _finalize_error(session: Session, run: CheckRun, message: str) -> None:
    run.status = CheckRunStatus.ERROR
    run.finished_at = _now()
    run.summary = message[:1024]
    session.commit()


def _jsonable(params: dict[str, object]) -> dict[str, object]:
    out: dict[str, object] = {}
    for k, v in params.items():
        if isinstance(v, str | int | float | bool) or v is None:
            out[k] = v
        else:
            out[k] = repr(v)
    return out

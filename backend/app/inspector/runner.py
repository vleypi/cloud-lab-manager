import structlog

from app.inspector.checks import handler_for
from app.inspector.ssh import SshSession, connect
from app.inspector.types import CheckOutcome, CheckTemplate, RunReport

logger = structlog.get_logger(__name__)


# выполнить все шаги шаблона по SSH собрать отчёт даже если соединение упало
async def run_template(template: CheckTemplate, *, host: str) -> RunReport:
    report = RunReport(template_name=template.name, template_version=template.version)

    session: SshSession
    try:
        session = await connect(host)
    except (OSError, TimeoutError) as exc:
        logger.warning("inspector_connect_failed", host=host, error=str(exc))
        for spec in template.checks:
            report.outcomes.append(
                (
                    spec,
                    CheckOutcome(
                        status="error",
                        message=f"SSH connection to {host} failed: {exc}",
                    ),
                )
            )
        return report
    except Exception as exc:
        logger.exception("inspector_connect_unexpected", host=host)
        for spec in template.checks:
            report.outcomes.append((spec, CheckOutcome(status="error", message=str(exc))))
        return report

    try:
        for spec in template.checks:
            try:
                outcome = await handler_for(spec.kind)(spec, session)
            except KeyError as exc:
                outcome = CheckOutcome(status="error", message=str(exc))
            except Exception as exc:
                logger.exception(
                    "inspector_check_unexpected",
                    check=spec.name,
                    kind=spec.kind.value,
                )
                outcome = CheckOutcome(status="error", message=str(exc))
            report.outcomes.append((spec, outcome))
    finally:
        await session.close()

    logger.info(
        "inspector_run_complete",
        template=template.name,
        host=host,
        total=report.total,
        passed=report.passed,
        failed=report.failed,
        errored=report.errored,
    )
    return report

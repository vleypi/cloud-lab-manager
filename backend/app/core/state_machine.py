from app.core.exceptions import OrchestratorError
from app.models.stand import StandStatus

_ALLOWED: dict[StandStatus, frozenset[StandStatus]] = {
    StandStatus.ALLOCATING: frozenset(
        {StandStatus.DEPLOYING, StandStatus.FAILED, StandStatus.CLEANING}
    ),
    StandStatus.DEPLOYING: frozenset(
        {StandStatus.READY, StandStatus.FAILED, StandStatus.CLEANING}
    ),
    StandStatus.READY: frozenset(
        {StandStatus.FROZEN, StandStatus.CLEANING, StandStatus.FAILED}
    ),
    StandStatus.FROZEN: frozenset(
        {StandStatus.READY, StandStatus.CLEANING}
    ),
    StandStatus.FAILED: frozenset({StandStatus.CLEANING, StandStatus.DESTROYED}),
    StandStatus.CLEANING: frozenset({StandStatus.DESTROYED, StandStatus.FAILED}),
    StandStatus.DESTROYED: frozenset(),
}

ACTIVE_STATUSES: frozenset[StandStatus] = frozenset(
    {
        StandStatus.ALLOCATING,
        StandStatus.DEPLOYING,
        StandStatus.READY,
        StandStatus.FROZEN,
        StandStatus.CLEANING,
    }
)


class InvalidTransitionError(OrchestratorError):
    http_status = 409
    code = "invalid_state_transition"


def can_transition(from_status: StandStatus, to_status: StandStatus) -> bool:
    return to_status in _ALLOWED.get(from_status, frozenset())


def assert_transition(from_status: StandStatus, to_status: StandStatus) -> None:
    if not can_transition(from_status, to_status):
        raise InvalidTransitionError(
            f"Cannot transition stand from {from_status.value!r} to {to_status.value!r}",
            details={"from": from_status.value, "to": to_status.value},
        )


def is_active(status: StandStatus) -> bool:
    return status in ACTIVE_STATUSES

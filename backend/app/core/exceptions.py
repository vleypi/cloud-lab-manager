class OrchestratorError(Exception):
    http_status: int = 500
    code: str = "internal_error"

    def __init__(self, message: str, *, details: dict | None = None) -> None:
        super().__init__(message)
        self.message = message
        self.details = details or {}


class PoolExhaustedError(OrchestratorError):
    http_status = 409
    code = "pool_exhausted"


class CapacityExceededError(OrchestratorError):
    http_status = 503
    code = "capacity_exceeded"


class AlreadyAllocatedError(OrchestratorError):
    http_status = 409
    code = "already_allocated"


class StandNotFoundError(OrchestratorError):
    http_status = 404
    code = "stand_not_found"


class CloudProviderError(OrchestratorError):
    http_status = 502
    code = "cloud_provider_error"


class ConsoleNotAvailableError(OrchestratorError):
    http_status = 409
    code = "console_not_available"


class ConsoleForbiddenError(OrchestratorError):
    http_status = 403
    code = "console_forbidden"


class LtiStateExpiredError(OrchestratorError):
    http_status = 410
    code = "lti_state_expired"

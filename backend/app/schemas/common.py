from typing import Any

from pydantic import BaseModel, Field


class ErrorResponse(BaseModel):
    code: str = Field(..., description="Машино-читаемый код ошибки")
    message: str = Field(..., description="Сообщение для пользователя")
    details: dict[str, Any] | None = Field(
        default=None, description="Структурированные подробности"
    )

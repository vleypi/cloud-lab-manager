from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class AdminLoginIn(BaseModel):
    # plain str без email-validator достаточно case-insensitive сравнения с БД
    email: str = Field(..., min_length=3, max_length=256)
    password: str = Field(..., min_length=1, max_length=512)


class DevLoginIn(BaseModel):
    external_id: str = Field(..., min_length=1, max_length=256)
    display_name: str | None = Field(default=None, max_length=256)
    is_super_admin: bool = False


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    external_id: str
    email: str | None
    display_name: str
    is_super_admin: bool


class MeOut(BaseModel):
    user: UserOut


class IsAuthenticatedOut(BaseModel):
    authenticated: bool
    is_super_admin: bool = False
    user_id: UUID | None = None

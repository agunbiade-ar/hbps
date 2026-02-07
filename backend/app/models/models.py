from pydantic import BaseModel
from typing import Optional
from sqlmodel import SQLModel
from uuid import UUID


class UserRegisterSchema(BaseModel):
    openmrs_uuid: UUID


class LoginResponse(BaseModel):
    message: str
    sessionId: str
    authenticated: bool
    user: Optional[dict] = None


class Token(SQLModel):
    access_token: str
    refresh_token: str
    token_type: str


class TokenData(SQLModel):
    id: int
    username: str
    openmrs_uuid: UUID
    exp: int

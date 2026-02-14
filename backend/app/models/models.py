from pydantic import BaseModel, Field
from typing import Optional, List
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


class BillUpdateRequest(BaseModel):
    item_ids: List[int]
    status: str


class OrderItem(BaseModel):
    concept_name: str
    concept_id: int
    category: str
    quantity: int
    order_id: int


class OrderPayload(BaseModel):
    id: int
    patient_id: int
    payer_id: int
    patient_name: str
    items: List[OrderItem]


class Facility(BaseModel):
    id: int
    facility_name: str
    facility_uuid: str
    state: str
    phone_no: str

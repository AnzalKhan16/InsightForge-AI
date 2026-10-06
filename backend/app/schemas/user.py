from datetime import datetime
import uuid

from pydantic import BaseModel, ConfigDict, EmailStr


class UserBase(BaseModel):
    email: EmailStr
    full_name: str | None = None


class UserCreate(UserBase):
    password: str


class UserResponse(UserBase):
    model_config = ConfigDict(from_attributes=True)
    
    id: uuid.UUID
    is_active: bool
    created_at: datetime
    updated_at: datetime
    last_login_at: datetime | None = None

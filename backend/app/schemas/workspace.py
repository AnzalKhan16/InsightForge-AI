from datetime import datetime
import uuid

from pydantic import BaseModel, ConfigDict


class WorkspaceBase(BaseModel):
    name: str
    slug: str


class WorkspaceCreate(WorkspaceBase):
    pass


class WorkspaceResponse(WorkspaceBase):
    model_config = ConfigDict(from_attributes=True)
    
    id: uuid.UUID
    owner_id: uuid.UUID | None
    created_at: datetime
    updated_at: datetime

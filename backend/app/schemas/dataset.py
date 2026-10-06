from pydantic import BaseModel, ConfigDict, Field
from datetime import datetime
from uuid import UUID
from app.db.enums import DatasetFormat, ProcessingStatus


class DatasetVersionResponse(BaseModel):
    id: UUID
    version_number: int
    original_filename: str
    format: DatasetFormat
    size_bytes: int
    status: ProcessingStatus
    created_at: datetime
    error_message: str | None = None
    model_config = ConfigDict(from_attributes=True)


class DatasetResponse(BaseModel):
    id: UUID
    name: str
    description: str | None = None
    workspace_id: UUID
    created_at: datetime
    updated_at: datetime
    versions: list[DatasetVersionResponse] = []
    model_config = ConfigDict(from_attributes=True)

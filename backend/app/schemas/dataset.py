from pydantic import BaseModel, ConfigDict, Field
from datetime import datetime
from uuid import UUID
from app.db.enums import DatasetFormat, ProcessingStatus


class DatasetMetadataResponse(BaseModel):
    id: UUID
    row_count: int | None = None
    column_count: int | None = None
    columns: list | None = None
    profile: dict | None = None
    quality: dict | None = None
    model_config = ConfigDict(from_attributes=True)


class DatasetArtifactResponse(BaseModel):
    id: UUID
    kind: str
    file_format: str
    size_bytes: int | None = None
    row_count: int | None = None
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class DatasetJobResponse(BaseModel):
    id: UUID
    job_type: str
    status: str
    result: dict | None = None
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class DatasetVersionResponse(BaseModel):
    id: UUID
    version_number: int
    original_filename: str
    format: DatasetFormat
    size_bytes: int
    status: ProcessingStatus
    created_at: datetime
    error_message: str | None = None
    dataset_metadata: DatasetMetadataResponse | None = None
    artifacts: list[DatasetArtifactResponse] = []
    jobs: list[DatasetJobResponse] = []
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

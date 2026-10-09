from uuid import UUID
from datetime import datetime
from pydantic import BaseModel, ConfigDict
from app.db.enums import JobType, JobStatus

class JobResponse(BaseModel):
    id: UUID
    version_id: UUID | None = None
    job_type: JobType
    status: JobStatus
    progress: int
    result: dict | None = None
    error_message: str | None = None
    queued_at: datetime | None = None
    started_at: datetime | None = None
    finished_at: datetime | None = None
    model_config = ConfigDict(from_attributes=True)

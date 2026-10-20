from typing import Any, Literal

from pydantic import BaseModel


class CleaningOperation(BaseModel):
    op: Literal["drop_duplicates", "drop_na", "fill_na", "trim_whitespace", "convert_type"]
    columns: list[str] | None = None
    params: dict[str, Any] | None = None

class CleanDatasetRequest(BaseModel):
    operations: list[CleaningOperation]

class CleanDatasetResponse(BaseModel):
    job_id: str
    message: str

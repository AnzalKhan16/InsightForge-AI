"""Domain enums. Stored as strings with CHECK constraints."""
from enum import StrEnum


class WorkspaceRole(StrEnum):
    OWNER = "owner"
    ADMIN = "admin"
    MEMBER = "member"
    VIEWER = "viewer"


class DatasetFormat(StrEnum):
    CSV = "csv"
    XLSX = "xlsx"
    XLS = "xls"


class ProcessingStatus(StrEnum):
    UPLOADED = "uploaded"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class ArtifactKind(StrEnum):
    """Derived (non-raw) files. Raw uploads live on DatasetVersion itself."""

    PROCESSED = "processed"  # normalised parquet used for analytics
    CLEANED = "cleaned"  # output of the cleaning pipeline
    PROFILE_EXPORT = "profile_export"


class JobType(StrEnum):
    PROFILE = "profile"
    CLEAN = "clean"
    ANALYZE = "analyze"
    FORECAST = "forecast"
    ANOMALY = "anomaly"
    SEGMENT = "segment"
    INSIGHT = "insight"
    REPORT = "report"


class JobStatus(StrEnum):
    QUEUED = "queued"
    RUNNING = "running"
    SUCCEEDED = "succeeded"
    FAILED = "failed"
    CANCELLED = "cancelled"


class ResultStatus(StrEnum):
    PENDING = "pending"
    COMPLETED = "completed"
    FAILED = "failed"


class InsightSource(StrEnum):
    DETERMINISTIC = "deterministic"  # rule/statistics-derived
    AI = "ai"  # LLM-narrated, grounded in structured evidence


class Severity(StrEnum):
    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"


class AnomalyStatus(StrEnum):
    OPEN = "open"
    REVIEWED = "reviewed"
    DISMISSED = "dismissed"


class ReportStatus(StrEnum):
    DRAFT = "draft"
    GENERATING = "generating"
    READY = "ready"
    FAILED = "failed"

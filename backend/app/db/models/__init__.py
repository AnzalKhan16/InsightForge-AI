"""Importing this package registers every model on Base.metadata (needed by Alembic)."""
from app.db.models.analytics import (
    Anomaly,
    Dashboard,
    Forecast,
    Insight,
    Report,
    SavedAnalysis,
    Segment,
)
from app.db.models.datasets import (
    Dataset,
    DatasetArtifact,
    DatasetMetadata,
    DatasetVersion,
    ProcessingJob,
)
from app.db.models.identity import User, Workspace, WorkspaceMembership

__all__ = [
    "Anomaly",
    "Dashboard",
    "Dataset",
    "DatasetArtifact",
    "DatasetMetadata",
    "DatasetVersion",
    "Forecast",
    "Insight",
    "ProcessingJob",
    "Report",
    "SavedAnalysis",
    "Segment",
    "User",
    "Workspace",
    "WorkspaceMembership",
]

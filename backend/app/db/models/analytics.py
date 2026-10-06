"""Analytical outputs: dashboards, saved analyses, insights, forecasts, anomalies, segments, reports.

All tables are workspace-scoped and reference a dataset *version* so results are reproducible
and never silently drift when a dataset is replaced by a newer version.
"""
import uuid

from sqlalchemy import (
    CheckConstraint,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    Uuid,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import (
    Base,
    CreatedByMixin,
    JSONType,
    TimestampMixin,
    UUIDPrimaryKeyMixin,
    WorkspaceScopedMixin,
    enum_col,
)
from app.db.enums import AnomalyStatus, InsightSource, ReportStatus, ResultStatus, Severity


def _version_fk(nullable: bool = False) -> Mapped:
    return mapped_column(
        Uuid, ForeignKey("dataset_versions.id", ondelete="CASCADE"), nullable=nullable, index=True
    )


class Dashboard(UUIDPrimaryKeyMixin, TimestampMixin, WorkspaceScopedMixin, CreatedByMixin, Base):
    __tablename__ = "dashboards"

    dataset_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("datasets.id", ondelete="SET NULL"), index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    layout: Mapped[dict | None] = mapped_column(JSONType)  # widgets: references to analyses, not data

    __table_args__ = (Index("ix_dashboards_workspace_id_created_at", "workspace_id", "created_at"),)


class SavedAnalysis(UUIDPrimaryKeyMixin, TimestampMixin, WorkspaceScopedMixin, CreatedByMixin, Base):
    __tablename__ = "saved_analyses"

    version_id: Mapped[uuid.UUID] = _version_fk()
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    analysis_type: Mapped[str] = mapped_column(String(64), nullable=False)  # e.g. timeseries, groupby
    config: Mapped[dict] = mapped_column(JSONType, nullable=False)  # deterministic query spec
    result: Mapped[dict | None] = mapped_column(JSONType)  # structured result (small aggregates only)

    __table_args__ = (Index("ix_saved_analyses_workspace_id_created_at", "workspace_id", "created_at"),)


class Insight(UUIDPrimaryKeyMixin, TimestampMixin, WorkspaceScopedMixin, Base):
    """A finding. `evidence` holds the structured facts it is grounded in (anti-hallucination)."""

    __tablename__ = "insights"

    version_id: Mapped[uuid.UUID] = _version_fk()
    analysis_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("saved_analyses.id", ondelete="SET NULL"), index=True
    )
    source: Mapped[InsightSource] = enum_col(InsightSource, nullable=False)
    severity: Mapped[Severity] = enum_col(Severity, nullable=False, default=Severity.INFO)
    category: Mapped[str | None] = mapped_column(String(64))
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    evidence: Mapped[dict | None] = mapped_column(JSONType)
    model_name: Mapped[str | None] = mapped_column(String(100))  # set when source = ai
    prompt_version: Mapped[str | None] = mapped_column(String(50))

    __table_args__ = (Index("ix_insights_workspace_id_version_id", "workspace_id", "version_id"),)


class Forecast(UUIDPrimaryKeyMixin, TimestampMixin, WorkspaceScopedMixin, CreatedByMixin, Base):
    __tablename__ = "forecasts"

    version_id: Mapped[uuid.UUID] = _version_fk()
    target_column: Mapped[str] = mapped_column(String(255), nullable=False)
    time_column: Mapped[str] = mapped_column(String(255), nullable=False)
    model_name: Mapped[str] = mapped_column(String(64), nullable=False)
    horizon: Mapped[int] = mapped_column(Integer, nullable=False)
    frequency: Mapped[str | None] = mapped_column(String(16))
    params: Mapped[dict | None] = mapped_column(JSONType)
    metrics: Mapped[dict | None] = mapped_column(JSONType)  # MAE/MAPE etc.
    result: Mapped[dict | None] = mapped_column(JSONType)  # points + intervals
    status: Mapped[ResultStatus] = enum_col(ResultStatus, nullable=False, default=ResultStatus.PENDING)
    error_message: Mapped[str | None] = mapped_column(Text)

    __table_args__ = (
        CheckConstraint("horizon > 0", name="horizon_positive"),
        Index("ix_forecasts_workspace_id_version_id", "workspace_id", "version_id"),
    )


class Anomaly(UUIDPrimaryKeyMixin, TimestampMixin, WorkspaceScopedMixin, Base):
    __tablename__ = "anomalies"

    version_id: Mapped[uuid.UUID] = _version_fk()
    column_name: Mapped[str | None] = mapped_column(String(255))
    method: Mapped[str] = mapped_column(String(64), nullable=False)  # zscore, iqr, isolation_forest
    row_index: Mapped[int | None] = mapped_column(Integer)
    observed_value: Mapped[float | None] = mapped_column(Float)
    expected_value: Mapped[float | None] = mapped_column(Float)
    score: Mapped[float | None] = mapped_column(Float)
    severity: Mapped[Severity] = enum_col(Severity, nullable=False, default=Severity.WARNING)
    status: Mapped[AnomalyStatus] = enum_col(AnomalyStatus, nullable=False, default=AnomalyStatus.OPEN)
    details: Mapped[dict | None] = mapped_column(JSONType)

    __table_args__ = (Index("ix_anomalies_workspace_id_version_id_status", "workspace_id", "version_id", "status"),)


class Segment(UUIDPrimaryKeyMixin, TimestampMixin, WorkspaceScopedMixin, Base):
    """One cluster/segment from a segmentation run (`run_id` groups segments of the same run)."""

    __tablename__ = "segments"

    version_id: Mapped[uuid.UUID] = _version_fk()
    run_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False, index=True)
    method: Mapped[str] = mapped_column(String(64), nullable=False)  # kmeans, rfm
    label: Mapped[str] = mapped_column(String(200), nullable=False)
    member_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    profile: Mapped[dict | None] = mapped_column(JSONType)  # centroid + descriptive stats
    params: Mapped[dict | None] = mapped_column(JSONType)

    __table_args__ = (CheckConstraint("member_count >= 0", name="members_nonneg"),)


class Report(UUIDPrimaryKeyMixin, TimestampMixin, WorkspaceScopedMixin, CreatedByMixin, Base):
    __tablename__ = "reports"

    dataset_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("datasets.id", ondelete="SET NULL"), index=True
    )
    version_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("dataset_versions.id", ondelete="SET NULL"), index=True
    )
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    status: Mapped[ReportStatus] = enum_col(ReportStatus, nullable=False, default=ReportStatus.DRAFT)
    content: Mapped[dict | None] = mapped_column(JSONType)  # structured sections referencing insights/analyses
    storage_key: Mapped[str | None] = mapped_column(String(1024))  # rendered PDF/HTML in object storage
    error_message: Mapped[str | None] = mapped_column(Text)

    __table_args__ = (Index("ix_reports_workspace_id_created_at", "workspace_id", "created_at"),)

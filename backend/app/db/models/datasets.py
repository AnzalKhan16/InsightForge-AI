"""Datasets, versions, derived artifacts, metadata and processing jobs.

Data boundaries
- DatasetVersion: logical record + pointer to the RAW immutable upload (object storage).
- DatasetArtifact: pointers to DERIVED files (processed/cleaned parquet) in object storage.
- DatasetMetadata: structured profile/schema (JSONB) - small, queryable, safe to give to the AI layer.
No file bytes are ever stored in PostgreSQL.
"""
import uuid
from datetime import datetime

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    Uuid,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import (
    Base,
    CreatedByMixin,
    JSONType,
    TimestampMixin,
    UUIDPrimaryKeyMixin,
    WorkspaceScopedMixin,
    enum_col,
)
from app.db.enums import ArtifactKind, DatasetFormat, JobStatus, JobType, ProcessingStatus


class Dataset(UUIDPrimaryKeyMixin, TimestampMixin, WorkspaceScopedMixin, CreatedByMixin, Base):
    """A logical dataset (stable identity); concrete data lives in versions."""

    __tablename__ = "datasets"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))  # soft delete

    versions: Mapped[list["DatasetVersion"]] = relationship(
        back_populates="dataset",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="DatasetVersion.version_number",
    )

    __table_args__ = (
        Index("ix_datasets_workspace_id_created_at", "workspace_id", "created_at"),
        # Names unique per workspace among non-deleted datasets.
        Index(
            "uq_datasets_workspace_name_active",
            "workspace_id",
            "name",
            unique=True,
            postgresql_where=text("deleted_at IS NULL"),
            sqlite_where=text("deleted_at IS NULL"),
        ),
    )


class DatasetVersion(UUIDPrimaryKeyMixin, TimestampMixin, WorkspaceScopedMixin, CreatedByMixin, Base):
    __tablename__ = "dataset_versions"

    dataset_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("datasets.id", ondelete="CASCADE"), nullable=False
    )
    version_number: Mapped[int] = mapped_column(Integer, nullable=False)
    is_current: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    # --- raw upload (immutable) ---
    original_filename: Mapped[str] = mapped_column(String(512), nullable=False)
    format: Mapped[DatasetFormat] = enum_col(DatasetFormat, nullable=False)
    size_bytes: Mapped[int] = mapped_column(BigInteger, nullable=False)
    checksum_sha256: Mapped[str] = mapped_column(String(64), nullable=False)
    raw_storage_key: Mapped[str] = mapped_column(String(1024), nullable=False)
    storage_backend: Mapped[str] = mapped_column(String(32), nullable=False, default="s3")

    # --- lifecycle ---
    status: Mapped[ProcessingStatus] = enum_col(
        ProcessingStatus, nullable=False, default=ProcessingStatus.UPLOADED
    )
    error_message: Mapped[str | None] = mapped_column(Text)
    processed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    dataset: Mapped[Dataset] = relationship(back_populates="versions")
    dataset_metadata: Mapped["DatasetMetadata | None"] = relationship(
        back_populates="version", uselist=False, cascade="all, delete-orphan", passive_deletes=True
    )
    artifacts: Mapped[list["DatasetArtifact"]] = relationship(
        back_populates="version", cascade="all, delete-orphan", passive_deletes=True
    )
    jobs: Mapped[list["ProcessingJob"]] = relationship(
        back_populates="version", cascade="all, delete-orphan", passive_deletes=True
    )

    __table_args__ = (
        UniqueConstraint("dataset_id", "version_number"),
        CheckConstraint("version_number >= 1", name="version_positive"),
        CheckConstraint("size_bytes >= 0", name="size_nonneg"),
        CheckConstraint("length(checksum_sha256) = 64", name="checksum_len"),
        Index("ix_dataset_versions_workspace_id_status", "workspace_id", "status"),
        Index("ix_dataset_versions_dataset_id_checksum_sha256", "dataset_id", "checksum_sha256"),
        # At most one current version per dataset.
        Index(
            "uq_dataset_versions_current",
            "dataset_id",
            unique=True,
            postgresql_where=text("is_current"),
            sqlite_where=text("is_current = 1"),
        ),
    )


class DatasetArtifact(UUIDPrimaryKeyMixin, TimestampMixin, WorkspaceScopedMixin, Base):
    """Derived, reproducible files (parquet) - never the raw upload."""

    __tablename__ = "dataset_artifacts"

    version_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("dataset_versions.id", ondelete="CASCADE"), nullable=False
    )
    kind: Mapped[ArtifactKind] = enum_col(ArtifactKind, nullable=False)
    storage_key: Mapped[str] = mapped_column(String(1024), nullable=False)
    storage_backend: Mapped[str] = mapped_column(String(32), nullable=False, default="s3")
    file_format: Mapped[str] = mapped_column(String(16), nullable=False, default="parquet")
    size_bytes: Mapped[int | None] = mapped_column(BigInteger)
    checksum_sha256: Mapped[str | None] = mapped_column(String(64))
    row_count: Mapped[int | None] = mapped_column(BigInteger)

    version: Mapped[DatasetVersion] = relationship(back_populates="artifacts")

    __table_args__ = (
        UniqueConstraint("version_id", "kind"),
        CheckConstraint("size_bytes IS NULL OR size_bytes >= 0", name="size_nonneg"),
    )


class DatasetMetadata(UUIDPrimaryKeyMixin, TimestampMixin, WorkspaceScopedMixin, Base):
    """Structured schema + profile of one version (1:1). Populated by the profiling pipeline."""

    __tablename__ = "dataset_metadata"

    version_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("dataset_versions.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    row_count: Mapped[int | None] = mapped_column(BigInteger)
    column_count: Mapped[int | None] = mapped_column(Integer)
    columns: Mapped[list | None] = mapped_column(JSONType)  # [{name, dtype, semantic_type, nullable...}]
    profile: Mapped[dict | None] = mapped_column(JSONType)  # full structured profile (Phase 5)
    quality: Mapped[dict | None] = mapped_column(JSONType)  # quality issues / score
    profile_version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)

    version: Mapped[DatasetVersion] = relationship(back_populates="dataset_metadata")

    __table_args__ = (
        CheckConstraint("row_count IS NULL OR row_count >= 0", name="rows_nonneg"),
        CheckConstraint("column_count IS NULL OR column_count >= 0", name="cols_nonneg"),
    )


class ProcessingJob(UUIDPrimaryKeyMixin, TimestampMixin, WorkspaceScopedMixin, CreatedByMixin, Base):
    """Durable record of background work (profiling, cleaning, ML...). Queue-agnostic."""

    __tablename__ = "processing_jobs"

    version_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("dataset_versions.id", ondelete="CASCADE")
    )
    job_type: Mapped[JobType] = enum_col(JobType, nullable=False)
    status: Mapped[JobStatus] = enum_col(JobStatus, nullable=False, default=JobStatus.QUEUED)
    progress: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    params: Mapped[dict | None] = mapped_column(JSONType)
    result: Mapped[dict | None] = mapped_column(JSONType)
    error_message: Mapped[str | None] = mapped_column(Text)
    queued_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    version: Mapped[DatasetVersion | None] = relationship(back_populates="jobs")

    __table_args__ = (
        CheckConstraint("progress BETWEEN 0 AND 100", name="progress_range"),
        CheckConstraint("attempts >= 0", name="attempts_nonneg"),
        Index("ix_processing_jobs_workspace_id_status", "workspace_id", "status"),
        Index("ix_processing_jobs_version_id_job_type", "version_id", "job_type"),
    )

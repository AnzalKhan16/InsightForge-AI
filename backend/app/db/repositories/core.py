import uuid
from collections.abc import Sequence
from datetime import UTC, datetime

from sqlalchemy import func, select, update

from app.db.enums import JobStatus, JobType, ProcessingStatus, WorkspaceRole
from app.db.models import (
    Dataset,
    DatasetArtifact,
    DatasetMetadata,
    DatasetVersion,
    ProcessingJob,
    User,
    Workspace,
    WorkspaceMembership,
)
from app.db.repositories.base import BaseRepository, WorkspaceScopedRepository


class UserRepository(BaseRepository[User]):
    model = User

    def get_by_email(self, email: str) -> User | None:
        stmt = select(User).where(func.lower(User.email) == email.strip().lower())
        return self.session.execute(stmt).scalar_one_or_none()

    def create(self, *, email: str, password_hash: str | None = None, full_name: str | None = None) -> User:
        return self.add(User(email=email.strip(), password_hash=password_hash, full_name=full_name))


class WorkspaceRepository(BaseRepository[Workspace]):
    model = Workspace

    def get_by_slug(self, slug: str) -> Workspace | None:
        return self.session.execute(select(Workspace).where(Workspace.slug == slug)).scalar_one_or_none()

    def create_with_owner(self, *, name: str, slug: str, owner: User) -> Workspace:
        ws = self.add(Workspace(name=name, slug=slug, owner_id=owner.id))
        self.session.add(WorkspaceMembership(workspace_id=ws.id, user_id=owner.id, role=WorkspaceRole.OWNER))
        self.session.flush()
        return ws

    def list_for_user(self, user_id: uuid.UUID) -> Sequence[Workspace]:
        stmt = (
            select(Workspace)
            .join(WorkspaceMembership, WorkspaceMembership.workspace_id == Workspace.id)
            .where(WorkspaceMembership.user_id == user_id)
            .order_by(Workspace.name)
        )
        return self.session.execute(stmt).scalars().all()

    def get_membership(self, workspace_id: uuid.UUID, user_id: uuid.UUID) -> WorkspaceMembership | None:
        stmt = select(WorkspaceMembership).where(
            WorkspaceMembership.workspace_id == workspace_id, WorkspaceMembership.user_id == user_id
        )
        return self.session.execute(stmt).scalar_one_or_none()


class DatasetRepository(WorkspaceScopedRepository[Dataset]):
    model = Dataset

    def get_active(self, workspace_id: uuid.UUID, dataset_id: uuid.UUID) -> Dataset | None:
        ds = self.get_in_workspace(workspace_id, dataset_id)
        return ds if ds is not None and ds.deleted_at is None else None

    def list_active(self, workspace_id: uuid.UUID, *, limit: int = 50, offset: int = 0) -> Sequence[Dataset]:
        stmt = (
            select(Dataset)
            .where(Dataset.workspace_id == workspace_id, Dataset.deleted_at.is_(None))
            .order_by(Dataset.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        return self.session.execute(stmt).scalars().all()

    def soft_delete(self, dataset: Dataset) -> None:
        dataset.deleted_at = datetime.now(UTC)
        self.session.flush()

    def add_version(
        self,
        dataset: Dataset,
        *,
        original_filename: str,
        format,
        size_bytes: int,
        checksum_sha256: str,
        raw_storage_key: str,
        storage_backend: str = "s3",
        created_by_id: uuid.UUID | None = None,
    ) -> DatasetVersion:
        """Append a new version and make it current (previous current is demoted atomically)."""
        next_no = (
            self.session.execute(
                select(func.coalesce(func.max(DatasetVersion.version_number), 0)).where(
                    DatasetVersion.dataset_id == dataset.id
                )
            ).scalar_one()
            + 1
        )
        self.session.execute(
            update(DatasetVersion)
            .where(DatasetVersion.dataset_id == dataset.id, DatasetVersion.is_current.is_(True))
            .values(is_current=False)
        )
        version = DatasetVersion(
            workspace_id=dataset.workspace_id,
            dataset_id=dataset.id,
            version_number=next_no,
            is_current=True,
            original_filename=original_filename,
            format=format,
            size_bytes=size_bytes,
            checksum_sha256=checksum_sha256,
            raw_storage_key=raw_storage_key,
            storage_backend=storage_backend,
            status=ProcessingStatus.UPLOADED,
            created_by_id=created_by_id,
        )
        self.session.add(version)
        self.session.flush()
        return version


class DatasetVersionRepository(WorkspaceScopedRepository[DatasetVersion]):
    model = DatasetVersion

    def current_for(self, workspace_id: uuid.UUID, dataset_id: uuid.UUID) -> DatasetVersion | None:
        stmt = select(DatasetVersion).where(
            DatasetVersion.workspace_id == workspace_id,
            DatasetVersion.dataset_id == dataset_id,
            DatasetVersion.is_current.is_(True),
        )
        return self.session.execute(stmt).scalar_one_or_none()

    def set_status(
        self, version: DatasetVersion, status: ProcessingStatus, *, error_message: str | None = None
    ) -> None:
        version.status = status
        version.error_message = error_message
        if status in (ProcessingStatus.COMPLETED, ProcessingStatus.FAILED):
            version.processed_at = datetime.now(UTC)
        self.session.flush()

    def upsert_metadata(self, version: DatasetVersion, **fields) -> DatasetMetadata:
        meta = version.dataset_metadata
        if meta is None:
            meta = DatasetMetadata(workspace_id=version.workspace_id)
            version.dataset_metadata = meta  # attach via relationship (keeps 1:1 in-memory state correct)
            self.session.add(meta)
        for k, v in fields.items():
            setattr(meta, k, v)
        self.session.flush()
        return meta

    def register_artifact(self, version: DatasetVersion, **fields) -> DatasetArtifact:
        art = DatasetArtifact(workspace_id=version.workspace_id, version_id=version.id, **fields)
        self.session.add(art)
        self.session.flush()
        return art


class ProcessingJobRepository(WorkspaceScopedRepository[ProcessingJob]):
    model = ProcessingJob

    def enqueue(
        self,
        *,
        workspace_id: uuid.UUID,
        job_type: JobType,
        version_id: uuid.UUID | None = None,
        params: dict | None = None,
        created_by_id: uuid.UUID | None = None,
    ) -> ProcessingJob:
        job = ProcessingJob(
            workspace_id=workspace_id,
            version_id=version_id,
            job_type=job_type,
            status=JobStatus.QUEUED,
            params=params,
            created_by_id=created_by_id,
            queued_at=datetime.now(UTC),
        )
        return self.add(job)

    def mark_running(self, job: ProcessingJob) -> None:
        job.status = JobStatus.RUNNING
        job.started_at = datetime.now(UTC)
        job.attempts += 1
        self.session.flush()

    def mark_finished(
        self, job: ProcessingJob, *, ok: bool, result: dict | None = None, error: str | None = None
    ) -> None:
        job.status = JobStatus.SUCCEEDED if ok else JobStatus.FAILED
        job.progress = 100 if ok else job.progress
        job.result = result
        job.error_message = error
        job.finished_at = datetime.now(UTC)
        self.session.flush()

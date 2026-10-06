import uuid
from typing import Sequence
from sqlalchemy import select
from sqlalchemy.orm import joinedload
from app.db.repositories.base import BaseRepository
from app.db.models.datasets import Dataset, DatasetVersion
from app.db.enums import DatasetFormat, ProcessingStatus
import hashlib

class DatasetRepository(BaseRepository[Dataset]):
    model = Dataset
    
    def __init__(self, session):
        super().__init__(session)

    def get_by_workspace(self, workspace_id: uuid.UUID) -> Sequence[Dataset]:
        stmt = (
            select(Dataset)
            .where(Dataset.workspace_id == workspace_id, Dataset.deleted_at == None)
            .options(joinedload(Dataset.versions))
            .order_by(Dataset.created_at.desc())
        )
        return self.session.execute(stmt).scalars().unique().all()

    def get_by_id_and_workspace(self, dataset_id: uuid.UUID, workspace_id: uuid.UUID) -> Dataset | None:
        stmt = (
            select(Dataset)
            .where(Dataset.id == dataset_id, Dataset.workspace_id == workspace_id, Dataset.deleted_at == None)
            .options(joinedload(Dataset.versions))
        )
        return self.session.execute(stmt).scalars().unique().first()

    def get_by_name(self, workspace_id: uuid.UUID, name: str) -> Dataset | None:
        stmt = (
            select(Dataset)
            .where(Dataset.workspace_id == workspace_id, Dataset.name == name, Dataset.deleted_at == None)
        )
        return self.session.execute(stmt).scalars().first()

    def create_dataset(self, name: str, workspace_id: uuid.UUID, user_id: uuid.UUID, description: str | None = None) -> Dataset:
        dataset = Dataset(
            name=name,
            description=description,
            workspace_id=workspace_id,
            created_by_id=user_id
        )
        self.session.add(dataset)
        self.session.flush()
        return dataset

    def create_version(
        self, 
        dataset_id: uuid.UUID, 
        workspace_id: uuid.UUID, 
        user_id: uuid.UUID,
        original_filename: str,
        format: DatasetFormat,
        size_bytes: int,
        storage_key: str,
        checksum: str = ""
    ) -> DatasetVersion:
        dataset = self.get(dataset_id)
        if not dataset:
            raise ValueError("Dataset not found")
            
        # Unset current flag on existing versions
        stmt = select(DatasetVersion).where(DatasetVersion.dataset_id == dataset_id)
        existing_versions = self.session.execute(stmt).scalars().all()
        for v in existing_versions:
            v.is_current = False
            
        version_num = len(existing_versions) + 1
        
        version = DatasetVersion(
            dataset_id=dataset_id,
            workspace_id=workspace_id,
            created_by_id=user_id,
            version_number=version_num,
            is_current=True,
            original_filename=original_filename,
            format=format,
            size_bytes=size_bytes,
            checksum_sha256=checksum.zfill(64)[:64],  # Ensure exact length of 64
            raw_storage_key=storage_key,
            status=ProcessingStatus.UPLOADED
        )
        self.session.add(version)
        self.session.flush()
        return version

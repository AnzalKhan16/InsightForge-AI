import os
import shutil
from abc import ABC, abstractmethod
from typing import BinaryIO
from pathlib import Path
from app.core.config import get_settings


class StorageBackend(ABC):
    @abstractmethod
    def upload_file(self, file_obj: BinaryIO, key: str) -> None:
        pass

    @abstractmethod
    def delete_file(self, key: str) -> None:
        pass

    @abstractmethod
    def get_file(self, key: str) -> BinaryIO:
        pass


class LocalStorageBackend(StorageBackend):
    def __init__(self, base_dir: str):
        self.base_dir = Path(base_dir)
        self.base_dir.mkdir(parents=True, exist_ok=True)

    def upload_file(self, file_obj: BinaryIO, key: str) -> None:
        file_path = self.base_dir / key
        file_path.parent.mkdir(parents=True, exist_ok=True)
        with open(file_path, "wb") as f:
            shutil.copyfileobj(file_obj, f)

    def delete_file(self, key: str) -> None:
        file_path = self.base_dir / key
        if file_path.exists():
            file_path.unlink()

    def get_file(self, key: str) -> BinaryIO:
        file_path = self.base_dir / key
        if not file_path.exists():
            raise FileNotFoundError(f"File {key} not found")
        return open(file_path, "rb")


def get_storage() -> StorageBackend:
    settings = get_settings()
    if settings.storage_backend == "local":
        return LocalStorageBackend(settings.storage_local_dir)
    else:
        raise NotImplementedError(f"Storage backend {settings.storage_backend} not implemented")

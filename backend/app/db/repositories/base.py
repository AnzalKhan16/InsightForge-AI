"""Repository base classes.

Rules
- Repositories own all SQL; services/routes never build queries.
- Workspace-owned entities are ONLY reachable through WorkspaceScopedRepository, which requires
  a workspace_id on every call. This makes tenant isolation structural, not optional.
- Repositories never commit; the unit of work (request/job) owns the transaction.
"""
import uuid
from collections.abc import Sequence
from typing import Generic, TypeVar

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.base import Base

T = TypeVar("T", bound=Base)


class BaseRepository(Generic[T]):
    model: type[T]

    def __init__(self, session: Session):
        self.session = session

    def get(self, id_: uuid.UUID) -> T | None:
        return self.session.get(self.model, id_)

    def add(self, obj: T) -> T:
        self.session.add(obj)
        self.session.flush()
        return obj

    def delete(self, obj: T) -> None:
        self.session.delete(obj)
        self.session.flush()


class WorkspaceScopedRepository(BaseRepository[T]):
    def get_in_workspace(self, workspace_id: uuid.UUID, id_: uuid.UUID) -> T | None:
        stmt = select(self.model).where(
            self.model.id == id_,  # type: ignore[attr-defined]
            self.model.workspace_id == workspace_id,  # type: ignore[attr-defined]
        )
        return self.session.execute(stmt).scalar_one_or_none()

    def list_in_workspace(
        self, workspace_id: uuid.UUID, *, limit: int = 50, offset: int = 0
    ) -> Sequence[T]:
        stmt = (
            select(self.model)
            .where(self.model.workspace_id == workspace_id)  # type: ignore[attr-defined]
            .order_by(self.model.created_at.desc())  # type: ignore[attr-defined]
            .limit(limit)
            .offset(offset)
        )
        return self.session.execute(stmt).scalars().all()

    def count_in_workspace(self, workspace_id: uuid.UUID) -> int:
        stmt = select(func.count()).select_from(self.model).where(
            self.model.workspace_id == workspace_id  # type: ignore[attr-defined]
        )
        return self.session.execute(stmt).scalar_one()

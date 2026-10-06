"""Declarative base, shared column types and mixins."""
import uuid
from datetime import datetime
from enum import Enum as PyEnum

from sqlalchemy import JSON, DateTime, Enum, ForeignKey, MetaData, Uuid, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, declared_attr, mapped_column

# Deterministic constraint names => reliable Alembic autogenerate / manual migrations.
NAMING_CONVENTION = {
    "ix": "ix_%(table_name)s_%(column_0_N_name)s",
    "uq": "uq_%(table_name)s_%(column_0_N_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}

# JSONB on PostgreSQL, plain JSON elsewhere (SQLite in unit tests).
JSONType = JSON().with_variant(JSONB(), "postgresql")


class Base(DeclarativeBase):
    metadata = MetaData(naming_convention=NAMING_CONVENTION)


def enum_col(enum_cls: type[PyEnum], **kwargs):
    """String-backed enum with a CHECK constraint (no native PG enum => easy migrations)."""
    return mapped_column(
        Enum(
            enum_cls,
            native_enum=False,
            length=32,
            create_constraint=True,
            name=enum_cls.__name__.lower(),
            values_callable=lambda e: [m.value for m in e],
        ),
        **kwargs,
    )


class UUIDPrimaryKeyMixin:
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class WorkspaceScopedMixin:
    """Every tenant-owned table carries workspace_id (the tenant boundary)."""

    @declared_attr
    def workspace_id(cls) -> Mapped[uuid.UUID]:  # noqa: N805
        return mapped_column(
            Uuid, ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True
        )


class CreatedByMixin:
    @declared_attr
    def created_by_id(cls) -> Mapped[uuid.UUID | None]:  # noqa: N805
        return mapped_column(Uuid, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

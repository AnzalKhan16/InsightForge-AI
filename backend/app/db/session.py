"""Engine / session management."""
from collections.abc import Iterator
from functools import lru_cache

from sqlalchemy import Engine, create_engine, event
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import get_settings


def build_engine(url: str | None = None) -> Engine:
    s = get_settings()
    url = url or s.database_url
    if url.startswith("sqlite"):
        engine = create_engine(url, echo=s.db_echo)

        @event.listens_for(engine, "connect")
        def _fk_on(dbapi_conn, _):  # SQLite needs FK enforcement switched on
            dbapi_conn.execute("PRAGMA foreign_keys=ON")

        return engine
    return create_engine(
        url,
        echo=s.db_echo,
        pool_size=s.db_pool_size,
        max_overflow=s.db_max_overflow,
        pool_pre_ping=True,
    )


@lru_cache
def get_engine() -> Engine:
    return build_engine()


@lru_cache
def get_sessionmaker() -> sessionmaker[Session]:
    return sessionmaker(bind=get_engine(), expire_on_commit=False, autoflush=False)


def get_db() -> Iterator[Session]:
    """FastAPI dependency: one session per request; commit on success, rollback on error."""
    session = get_sessionmaker()()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()

"""Test DB fixtures. SQLite in-memory by default; set IF_TEST_DATABASE_URL to run on PostgreSQL."""
import os

import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db import models  # noqa: F401
from app.db.base import Base


@pytest.fixture(scope="session")
def engine():
    url = os.environ.get("IF_TEST_DATABASE_URL")
    if url:
        eng = create_engine(url)
    else:
        # single shared connection so :memory: persists across sessions
        eng = create_engine(
            "sqlite+pysqlite:///:memory:", poolclass=StaticPool, connect_args={"check_same_thread": False}
        )
        event.listen(eng, "connect", lambda c, _: c.execute("PRAGMA foreign_keys=ON"))
    Base.metadata.drop_all(eng)
    Base.metadata.create_all(eng)
    yield eng
    Base.metadata.drop_all(eng)


@pytest.fixture
def session(engine):
    """Each test runs inside a transaction that is rolled back."""
    conn = engine.connect()
    trans = conn.begin()
    s = sessionmaker(
        bind=conn, expire_on_commit=False, autoflush=False, join_transaction_mode="create_savepoint"
    )()
    yield s
    s.close()
    trans.rollback()
    conn.close()

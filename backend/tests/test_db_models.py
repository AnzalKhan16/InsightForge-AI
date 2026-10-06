import uuid

import pytest
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.db.enums import DatasetFormat, JobType, ProcessingStatus
from app.db.models import Dataset, DatasetVersion, Insight
from app.db.repositories import (
    DatasetRepository,
    DatasetVersionRepository,
    ProcessingJobRepository,
    UserRepository,
    WorkspaceRepository,
)

SHA = "a" * 64


def make_workspace(session, email="owner@example.com", slug="acme"):
    user = UserRepository(session).create(email=email, full_name="Owner")
    ws = WorkspaceRepository(session).create_with_owner(name="Acme", slug=slug, owner=user)
    return user, ws


def make_version(session, ws, user, name="sales", filename="sales.csv"):
    repo = DatasetRepository(session)
    ds = repo.add(Dataset(workspace_id=ws.id, name=name, created_by_id=user.id))
    v = repo.add_version(
        ds,
        original_filename=filename,
        format=DatasetFormat.CSV,
        size_bytes=100,
        checksum_sha256=SHA,
        raw_storage_key=f"workspaces/{ws.id}/datasets/{ds.id}/v1/raw/{filename}",
        created_by_id=user.id,
    )
    return ds, v


def test_user_email_unique_case_insensitive(session):
    UserRepository(session).create(email="A@Example.com")
    with pytest.raises(IntegrityError):
        UserRepository(session).create(email="a@example.COM")


def test_workspace_owner_membership(session):
    user, ws = make_workspace(session)
    assert [w.id for w in WorkspaceRepository(session).list_for_user(user.id)] == [ws.id]
    assert WorkspaceRepository(session).get_membership(ws.id, user.id).role.value == "owner"


def test_workspace_slug_unique(session):
    make_workspace(session)
    u2 = UserRepository(session).create(email="b@example.com")
    with pytest.raises(IntegrityError):
        WorkspaceRepository(session).create_with_owner(name="Other", slug="acme", owner=u2)


def test_dataset_versioning_single_current(session):
    user, ws = make_workspace(session)
    ds, v1 = make_version(session, ws, user)
    v2 = DatasetRepository(session).add_version(
        ds,
        original_filename="sales_v2.csv",
        format=DatasetFormat.CSV,
        size_bytes=200,
        checksum_sha256="b" * 64,
        raw_storage_key="k2",
    )
    session.refresh(v1)
    assert (v1.version_number, v2.version_number) == (1, 2)
    assert v1.is_current is False and v2.is_current is True
    assert DatasetVersionRepository(session).current_for(ws.id, ds.id).id == v2.id


def test_only_one_current_version_enforced_by_db(session):
    user, ws = make_workspace(session)
    ds, _ = make_version(session, ws, user)
    session.add(
        DatasetVersion(
            workspace_id=ws.id, dataset_id=ds.id, version_number=2, is_current=True,
            original_filename="x.csv", format=DatasetFormat.CSV, size_bytes=1,
            checksum_sha256=SHA, raw_storage_key="k",
        )
    )
    with pytest.raises(IntegrityError):
        session.flush()


def test_version_check_constraints(session):
    user, ws = make_workspace(session)
    ds, _ = make_version(session, ws, user)
    session.add(
        DatasetVersion(
            workspace_id=ws.id, dataset_id=ds.id, version_number=2, original_filename="x.csv",
            format=DatasetFormat.CSV, size_bytes=-5, checksum_sha256=SHA, raw_storage_key="k",
        )
    )
    with pytest.raises(IntegrityError):
        session.flush()


def test_active_dataset_name_unique_per_workspace(session):
    user, ws = make_workspace(session)
    repo = DatasetRepository(session)
    repo.add(Dataset(workspace_id=ws.id, name="sales"))
    with pytest.raises(IntegrityError):
        repo.add(Dataset(workspace_id=ws.id, name="sales"))


def test_name_reusable_after_soft_delete(session):
    user, ws = make_workspace(session)
    repo = DatasetRepository(session)
    d1 = repo.add(Dataset(workspace_id=ws.id, name="sales"))
    repo.soft_delete(d1)
    d2 = repo.add(Dataset(workspace_id=ws.id, name="sales"))
    assert d2.id != d1.id
    assert [d.id for d in repo.list_active(ws.id)] == [d2.id]


def test_tenant_isolation_in_repositories(session):
    u1, ws1 = make_workspace(session, "a@x.com", "ws-a")
    u2, ws2 = make_workspace(session, "b@x.com", "ws-b")
    ds, _ = make_version(session, ws1, u1)
    repo = DatasetRepository(session)
    assert repo.get_active(ws1.id, ds.id) is not None
    assert repo.get_active(ws2.id, ds.id) is None  # other tenant cannot see it
    assert repo.list_active(ws2.id) == []


def test_metadata_one_to_one_and_status_lifecycle(session):
    user, ws = make_workspace(session)
    _, v = make_version(session, ws, user)
    vrepo = DatasetVersionRepository(session)
    vrepo.upsert_metadata(v, row_count=10, column_count=2, columns=[{"name": "a", "dtype": "int"}])
    vrepo.upsert_metadata(v, row_count=11)  # update, not duplicate
    session.refresh(v)
    assert v.dataset_metadata.row_count == 11
    vrepo.set_status(v, ProcessingStatus.COMPLETED)
    assert v.processed_at is not None


def test_artifact_unique_per_kind(session):
    user, ws = make_workspace(session)
    _, v = make_version(session, ws, user)
    vrepo = DatasetVersionRepository(session)
    vrepo.register_artifact(v, kind="processed", storage_key="p1")
    with pytest.raises(IntegrityError):
        vrepo.register_artifact(v, kind="processed", storage_key="p2")


def test_job_lifecycle_and_progress_check(session):
    user, ws = make_workspace(session)
    _, v = make_version(session, ws, user)
    jobs = ProcessingJobRepository(session)
    job = jobs.enqueue(workspace_id=ws.id, job_type=JobType.PROFILE, version_id=v.id)
    jobs.mark_running(job)
    jobs.mark_finished(job, ok=True, result={"rows": 10})
    assert job.status.value == "succeeded" and job.progress == 100 and job.attempts == 1
    job.progress = 150
    with pytest.raises(IntegrityError):
        session.flush()


def test_cascade_delete_dataset_removes_children(session):
    user, ws = make_workspace(session)
    ds, v = make_version(session, ws, user)
    session.add(
        Insight(workspace_id=ws.id, version_id=v.id, source="deterministic", title="t", body="b")
    )
    session.flush()
    vid = v.id
    session.delete(ds)
    session.flush()
    assert session.execute(select(DatasetVersion).where(DatasetVersion.id == vid)).first() is None
    assert session.execute(select(Insight).where(Insight.version_id == vid)).first() is None


def test_workspace_fk_enforced(session):
    session.add(Dataset(workspace_id=uuid.uuid4(), name="orphan"))
    with pytest.raises(IntegrityError):
        session.flush()

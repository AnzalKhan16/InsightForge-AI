import uuid
import hashlib
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, BackgroundTasks
from app.api.deps import ActiveUser, SessionDep
from app.db.repositories.core import WorkspaceRepository
from app.db.repositories.datasets import DatasetRepository
from app.schemas.dataset import DatasetResponse, DatasetVersionResponse
from app.core.storage import get_storage
from app.db.enums import DatasetFormat

router = APIRouter()

MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB
ALLOWED_EXTENSIONS = {".csv": DatasetFormat.CSV, ".xlsx": DatasetFormat.XLSX, ".xls": DatasetFormat.XLS}


def _check_workspace_access(session, workspace_id: uuid.UUID, user_id: uuid.UUID):
    ws_repo = WorkspaceRepository(session)
    if not ws_repo.get_membership(workspace_id, user_id):
        raise HTTPException(status_code=404, detail="Workspace not found or access denied")


@router.get("/workspaces/{workspace_id}/datasets", response_model=list[DatasetResponse])
def list_datasets(workspace_id: uuid.UUID, current_user: ActiveUser, session: SessionDep):
    _check_workspace_access(session, workspace_id, current_user.id)
    repo = DatasetRepository(session)
    return repo.get_by_workspace(workspace_id)


@router.post("/workspaces/{workspace_id}/datasets", response_model=DatasetResponse)
async def upload_dataset(
    workspace_id: uuid.UUID,
    current_user: ActiveUser,
    session: SessionDep,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    name: str = Form(...),
    description: str | None = Form(None)
):
    _check_workspace_access(session, workspace_id, current_user.id)
    
    # Validate file size (reading into memory for now; acceptable for < 50MB)
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File too large. Max size is 50MB.")
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="File is empty.")

    # Validate extension
    ext = ""
    if file.filename:
        ext = "." + file.filename.split(".")[-1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Unsupported file format. Use CSV or Excel.")
    dataset_format = ALLOWED_EXTENSIONS[ext]

    repo = DatasetRepository(session)
    
    # Check if dataset name already exists
    dataset = repo.get_by_name(workspace_id, name)
    if not dataset:
        dataset = repo.create_dataset(name=name, description=description, workspace_id=workspace_id, user_id=current_user.id)

    # Hash content
    checksum = hashlib.sha256(content).hexdigest()
    
    # Generate unique storage key
    storage_key = f"{workspace_id}/{dataset.id}/{uuid.uuid4().hex}{ext}"
    
    # Save to storage
    import io
    storage = get_storage()
    storage.upload_file(io.BytesIO(content), storage_key)

    # Save version record
    version = repo.create_version(
        dataset_id=dataset.id,
        workspace_id=workspace_id,
        user_id=current_user.id,
        original_filename=file.filename or "unknown",
        format=dataset_format,
        size_bytes=len(content),
        storage_key=storage_key,
        checksum=checksum
    )
    
    # Enqueue profiling
    from app.core.profiling import profile_dataset_task
    background_tasks.add_task(
        profile_dataset_task,
        version_id=version.id,
        workspace_id=workspace_id,
        storage_key=storage_key,
        format=dataset_format
    )

    
    # Re-fetch with versions
    return repo.get_by_id_and_workspace(dataset.id, workspace_id)


@router.get("/workspaces/{workspace_id}/datasets/{dataset_id}", response_model=DatasetResponse)
def get_dataset(workspace_id: uuid.UUID, dataset_id: uuid.UUID, current_user: ActiveUser, session: SessionDep):
    _check_workspace_access(session, workspace_id, current_user.id)
    repo = DatasetRepository(session)
    dataset = repo.get_by_id_and_workspace(dataset_id, workspace_id)
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    return dataset


@router.delete("/workspaces/{workspace_id}/datasets/{dataset_id}", status_code=204)
def delete_dataset(workspace_id: uuid.UUID, dataset_id: uuid.UUID, current_user: ActiveUser, session: SessionDep):
    _check_workspace_access(session, workspace_id, current_user.id)
    repo = DatasetRepository(session)
    dataset = repo.get_by_id_and_workspace(dataset_id, workspace_id)
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    
    import datetime
    dataset.deleted_at = datetime.datetime.now(datetime.timezone.utc)
    session.flush()
    return None

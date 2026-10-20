import uuid
import hashlib
from typing import Optional
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, BackgroundTasks
from app.api.deps import ActiveUser, SessionDep
from app.db.repositories.core import WorkspaceRepository
from app.db.repositories.datasets import DatasetRepository
from app.schemas.dataset import DatasetResponse, DatasetVersionResponse
from app.core.storage import get_storage
from app.db.enums import DatasetFormat
from pydantic import BaseModel, Field

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


@router.post("/workspaces/{workspace_id}/datasets/{dataset_id}/clean")
def clean_dataset(
    workspace_id: uuid.UUID, 
    dataset_id: uuid.UUID, 
    request: dict, 
    current_user: ActiveUser, 
    session: SessionDep,
    background_tasks: BackgroundTasks
):
    _check_workspace_access(session, workspace_id, current_user.id)
    repo = DatasetRepository(session)
    dataset = repo.get_by_id_and_workspace(dataset_id, workspace_id)
    
    if not dataset or not dataset.versions:
        raise HTTPException(status_code=404, detail="Dataset or version not found")
        
    latest_version = dataset.versions[-1]
    
    from app.db.models.datasets import ProcessingJob
    from app.db.enums import JobType, JobStatus
    
    job = ProcessingJob(
        workspace_id=workspace_id,
        created_by_id=current_user.id,
        version_id=latest_version.id,
        job_type=JobType.CLEAN,
        status=JobStatus.QUEUED,
        params={"operations": request.get("operations", [])}
    )
    session.add(job)
    session.flush()
    
    from app.core.cleaning import clean_dataset_task
    background_tasks.add_task(clean_dataset_task, job_id=job.id)
    
    return {"job_id": str(job.id), "message": "Cleaning job started"}

@router.get("/workspaces/{workspace_id}/jobs/{job_id}")
def get_job_status(workspace_id: uuid.UUID, job_id: uuid.UUID, current_user: ActiveUser, session: SessionDep):
    _check_workspace_access(session, workspace_id, current_user.id)
    from app.db.models.datasets import ProcessingJob
    from sqlalchemy import select
    
    job = session.execute(
        select(ProcessingJob).where(ProcessingJob.id == job_id, ProcessingJob.workspace_id == workspace_id)
    ).scalar_one_or_none()
    
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
        
    return {
        "id": job.id,
        "job_type": job.job_type,
        "status": job.status,
        "progress": job.progress,
        "result": job.result,
        "error_message": job.error_message
    }

@router.post("/workspaces/{workspace_id}/datasets/{dataset_id}/analyze")
def analyze_dataset(
    workspace_id: uuid.UUID, 
    dataset_id: uuid.UUID, 
    current_user: ActiveUser, 
    session: SessionDep,
    background_tasks: BackgroundTasks
):
    _check_workspace_access(session, workspace_id, current_user.id)
    repo = DatasetRepository(session)
    dataset = repo.get_by_id_and_workspace(dataset_id, workspace_id)
    
    if not dataset or not dataset.versions:
        raise HTTPException(status_code=404, detail="Dataset or version not found")
        
    latest_version = dataset.versions[-1]
    
    from app.db.models.datasets import ProcessingJob
    from app.db.enums import JobType, JobStatus
    
    job = ProcessingJob(
        workspace_id=workspace_id,
        created_by_id=current_user.id,
        version_id=latest_version.id,
        job_type=JobType.ANALYZE,
        status=JobStatus.QUEUED,
        params={}
    )
    session.add(job)
    session.flush()
    
    from app.core.analytics_task import analyze_dataset_task
    background_tasks.add_task(analyze_dataset_task, job_id=job.id)
    
    return {"job_id": str(job.id), "message": "Analytics job started"}

@router.get("/workspaces/{workspace_id}/datasets/{dataset_id}/analyses")
def get_dataset_analyses(workspace_id: uuid.UUID, dataset_id: uuid.UUID, current_user: ActiveUser, session: SessionDep):
    _check_workspace_access(session, workspace_id, current_user.id)
    from app.db.models.analytics import SavedAnalysis
    from app.db.models.datasets import DatasetVersion
    from sqlalchemy import select
    
    stmt = (
        select(SavedAnalysis)
        .join(DatasetVersion, SavedAnalysis.version_id == DatasetVersion.id)
        .where(
            SavedAnalysis.workspace_id == workspace_id,
            DatasetVersion.dataset_id == dataset_id
        )
        .order_by(SavedAnalysis.created_at.desc())
    )
    analyses = session.execute(stmt).scalars().all()
    
    return [
        {
            "id": a.id,
            "version_id": a.version_id,
            "name": a.name,
            "analysis_type": a.analysis_type,
            "result": a.result,
            "created_at": a.created_at
        } for a in analyses
    ]

@router.post("/workspaces/{workspace_id}/datasets/{dataset_id}/insights/generate")
def generate_dataset_insights(
    workspace_id: uuid.UUID,
    dataset_id: uuid.UUID,
    current_user: ActiveUser,
    session: SessionDep,
    background_tasks: BackgroundTasks
):
    _check_workspace_access(session, workspace_id, current_user.id)
    repo = DatasetRepository(session)
    dataset = repo.get_by_id_and_workspace(dataset_id, workspace_id)

    if not dataset or not dataset.versions:
        raise HTTPException(status_code=404, detail="Dataset or version not found")

    latest_version = dataset.versions[-1]

    from app.db.models.datasets import ProcessingJob
    from app.db.enums import JobType, JobStatus

    job = ProcessingJob(
        workspace_id=workspace_id,
        created_by_id=current_user.id,
        version_id=latest_version.id,
        job_type=JobType.INSIGHT,
        status=JobStatus.QUEUED,
        params={}
    )
    session.add(job)
    session.flush()

    from app.core.insights_task import generate_insights_task
    background_tasks.add_task(generate_insights_task, job_id=job.id)

    return {"job_id": str(job.id), "message": "Insight generation job started"}

@router.get("/workspaces/{workspace_id}/datasets/{dataset_id}/insights")
def get_dataset_insights(
    workspace_id: uuid.UUID,
    dataset_id: uuid.UUID,
    current_user: ActiveUser,
    session: SessionDep
):
    _check_workspace_access(session, workspace_id, current_user.id)
    from app.db.models.analytics import Insight
    from app.db.models.datasets import DatasetVersion
    from sqlalchemy import select

    stmt = (
        select(Insight)
        .join(DatasetVersion, Insight.version_id == DatasetVersion.id)
        .where(
            Insight.workspace_id == workspace_id,
            DatasetVersion.dataset_id == dataset_id
        )
        .order_by(Insight.created_at.desc())
    )
    insights = session.execute(stmt).scalars().all()

    return [
        {
            "id": i.id,
            "version_id": i.version_id,
            "analysis_id": i.analysis_id,
            "source": i.source,
            "severity": i.severity,
            "category": i.category,
            "title": i.title,
            "body": i.body,
            "evidence": i.evidence,
            "model_name": i.model_name,
            "prompt_version": i.prompt_version,
            "created_at": i.created_at,
        } for i in insights
    ]


class NLQueryRequest(BaseModel):
    question: str = Field(..., min_length=2, max_length=500)


@router.post("/workspaces/{workspace_id}/datasets/{dataset_id}/nl-query")
def query_dataset_natural_language(
    workspace_id: uuid.UUID,
    dataset_id: uuid.UUID,
    payload: NLQueryRequest,
    current_user: ActiveUser,
    session: SessionDep
):
    _check_workspace_access(session, workspace_id, current_user.id)
    repo = DatasetRepository(session)
    dataset = repo.get_by_id_and_workspace(dataset_id, workspace_id)

    if not dataset or not dataset.versions:
        raise HTTPException(status_code=404, detail="Dataset or version not found")

    latest_version = dataset.versions[-1]

    storage = get_storage()
    try:
        file_obj = storage.get_file(latest_version.raw_storage_key)
        file_bytes = file_obj.read()
        file_obj.close()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read dataset file from storage: {e}")

    import io
    import pandas as pd
    from app.db.enums import DatasetFormat
    try:
        if latest_version.format == DatasetFormat.CSV:
            df = pd.read_csv(io.BytesIO(file_bytes))
        elif latest_version.format in (DatasetFormat.XLSX, DatasetFormat.XLS):
            df = pd.read_excel(io.BytesIO(file_bytes))
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported format: {latest_version.format}")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse dataset data: {e}")

    from app.core.nl_analytics import execute_nl_query
    response = execute_nl_query(df, payload.question)
    return response.model_dump()


class ForecastRequest(BaseModel):
    target_column: Optional[str] = None
    time_column: Optional[str] = None
    horizon: int = Field(default=6, ge=1, le=24)
    frequency: Optional[str] = None
    model_type: str = "auto"


@router.get("/workspaces/{workspace_id}/datasets/{dataset_id}/forecast/schema")
def get_dataset_forecast_schema(
    workspace_id: uuid.UUID,
    dataset_id: uuid.UUID,
    current_user: ActiveUser,
    session: SessionDep
):
    _check_workspace_access(session, workspace_id, current_user.id)
    repo = DatasetRepository(session)
    dataset = repo.get_by_id_and_workspace(dataset_id, workspace_id)

    if not dataset or not dataset.versions:
        raise HTTPException(status_code=404, detail="Dataset or version not found")

    latest_version = dataset.versions[-1]
    storage = get_storage()
    file_obj = storage.get_file(latest_version.raw_storage_key)
    file_bytes = file_obj.read()
    file_obj.close()

    import io
    import pandas as pd
    from app.db.enums import DatasetFormat
    if latest_version.format == DatasetFormat.CSV:
        df = pd.read_csv(io.BytesIO(file_bytes))
    elif latest_version.format in (DatasetFormat.XLSX, DatasetFormat.XLS):
        df = pd.read_excel(io.BytesIO(file_bytes))
    else:
        raise HTTPException(status_code=400, detail=f"Unsupported format: {latest_version.format}")

    from app.engine.ml.forecasting import detect_temporal_schema
    return detect_temporal_schema(df)


@router.post("/workspaces/{workspace_id}/datasets/{dataset_id}/forecast")
def run_dataset_forecast(
    workspace_id: uuid.UUID,
    dataset_id: uuid.UUID,
    payload: ForecastRequest,
    current_user: ActiveUser,
    session: SessionDep
):
    _check_workspace_access(session, workspace_id, current_user.id)
    repo = DatasetRepository(session)
    dataset = repo.get_by_id_and_workspace(dataset_id, workspace_id)

    if not dataset or not dataset.versions:
        raise HTTPException(status_code=404, detail="Dataset or version not found")

    latest_version = dataset.versions[-1]
    storage = get_storage()
    file_obj = storage.get_file(latest_version.raw_storage_key)
    file_bytes = file_obj.read()
    file_obj.close()

    import io
    import pandas as pd
    from app.db.enums import DatasetFormat
    if latest_version.format == DatasetFormat.CSV:
        df = pd.read_csv(io.BytesIO(file_bytes))
    elif latest_version.format in (DatasetFormat.XLSX, DatasetFormat.XLS):
        df = pd.read_excel(io.BytesIO(file_bytes))
    else:
        raise HTTPException(status_code=400, detail=f"Unsupported format: {latest_version.format}")

    from app.engine.ml.forecasting import (
        detect_temporal_schema,
        generate_forecast,
        ForecastModelType,
        TimeSeriesSuitabilityError,
    )

    schema = detect_temporal_schema(df)
    target_col = payload.target_column or schema.get("primary_metric")
    time_col = payload.time_column or schema.get("primary_date")

    if not time_col:
        raise HTTPException(
            status_code=400,
            detail="Cannot generate forecast: no valid temporal/date column found in dataset."
        )
    if not target_col:
        raise HTTPException(
            status_code=400,
            detail="Cannot generate forecast: no numeric target metric column specified or found."
        )

    try:
        model_enum = ForecastModelType(payload.model_type)
    except Exception:
        model_enum = ForecastModelType.AUTO

    try:
        res = generate_forecast(
            df=df,
            time_column=time_col,
            target_column=target_col,
            horizon=payload.horizon,
            frequency=payload.frequency,
            preferred_model=model_enum,
        )
    except TimeSeriesSuitabilityError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Forecasting engine failed: {e}")

    from app.db.models.analytics import Forecast
    from app.db.enums import ResultStatus

    record = Forecast(
        workspace_id=workspace_id,
        created_by_id=current_user.id,
        version_id=latest_version.id,
        target_column=res["target_column"],
        time_column=res["time_column"],
        model_name=res["selected_model"],
        horizon=res["horizon"],
        frequency=res["frequency"],
        params=res["model_parameters"],
        metrics=res["validation_metrics"],
        result=res,
        status=ResultStatus.COMPLETED,
    )
    session.add(record)
    session.commit()

    return {
        "id": str(record.id),
        "status": "success",
        **res
    }


@router.get("/workspaces/{workspace_id}/datasets/{dataset_id}/forecasts")
def list_dataset_forecasts(
    workspace_id: uuid.UUID,
    dataset_id: uuid.UUID,
    current_user: ActiveUser,
    session: SessionDep
):
    _check_workspace_access(session, workspace_id, current_user.id)
    from app.db.models.analytics import Forecast
    from app.db.models.datasets import DatasetVersion
    from sqlalchemy import select

    stmt = (
        select(Forecast)
        .join(DatasetVersion, Forecast.version_id == DatasetVersion.id)
        .where(
            Forecast.workspace_id == workspace_id,
            DatasetVersion.dataset_id == dataset_id
        )
        .order_by(Forecast.created_at.desc())
    )
    records = session.execute(stmt).scalars().all()
    return [
        {
            "id": r.id,
            "version_id": r.version_id,
            "target_column": r.target_column,
            "time_column": r.time_column,
            "model_name": r.model_name,
            "horizon": r.horizon,
            "frequency": r.frequency,
            "params": r.params,
            "metrics": r.metrics,
            "result": r.result,
            "status": r.status,
            "created_at": r.created_at,
        }
        for r in records
    ]


class AnomalyDetectionRequest(BaseModel):
    method: Optional[str] = None
    target_column: Optional[str] = None


class AnomalyStatusUpdateRequest(BaseModel):
    status: str


@router.post("/workspaces/{workspace_id}/datasets/{dataset_id}/anomalies/detect")
def detect_dataset_anomalies(
    workspace_id: uuid.UUID,
    dataset_id: uuid.UUID,
    payload: AnomalyDetectionRequest,
    current_user: ActiveUser,
    session: SessionDep
):
    _check_workspace_access(session, workspace_id, current_user.id)
    repo = DatasetRepository(session)
    dataset = repo.get_by_id_and_workspace(dataset_id, workspace_id)

    if not dataset or not dataset.versions:
        raise HTTPException(status_code=404, detail="Dataset or version not found")

    latest_version = dataset.versions[-1]
    storage = get_storage()
    file_obj = storage.get_file(latest_version.raw_storage_key)
    file_bytes = file_obj.read()
    file_obj.close()

    import io
    import pandas as pd
    from app.db.enums import DatasetFormat
    if latest_version.format == DatasetFormat.CSV:
        df = pd.read_csv(io.BytesIO(file_bytes))
    elif latest_version.format in (DatasetFormat.XLSX, DatasetFormat.XLS):
        df = pd.read_excel(io.BytesIO(file_bytes))
    else:
        raise HTTPException(status_code=400, detail=f"Unsupported format: {latest_version.format}")

    from app.engine.ml.anomaly import run_comprehensive_anomaly_detection, DetectionMethod
    det_method = None
    if payload.method:
        try:
            det_method = DetectionMethod(payload.method.lower())
        except Exception:
            det_method = None

    res = run_comprehensive_anomaly_detection(
        df=df,
        method=det_method,
        target_column=payload.target_column,
    )

    from app.db.models.analytics import Anomaly
    from app.db.enums import Severity, AnomalyStatus
    from sqlalchemy import delete

    # Remove previous detected anomalies for this version
    session.execute(
        delete(Anomaly).where(
            Anomaly.workspace_id == workspace_id,
            Anomaly.version_id == latest_version.id,
        )
    )

    persisted_anomalies = []
    for a in res["anomalies"]:
        sev = Severity.CRITICAL if a["severity"] == "critical" else (Severity.WARNING if a["severity"] == "warning" else Severity.INFO)
        record = Anomaly(
            workspace_id=workspace_id,
            version_id=latest_version.id,
            column_name=a["column_name"],
            method=a["method"],
            row_index=a["row_index"],
            observed_value=a["observed_value"],
            expected_value=a["expected_value"],
            score=a["score"],
            severity=sev,
            status=AnomalyStatus.OPEN,
            details={
                "nature": a["nature"],
                "title": a["title"],
                "explanation": a["explanation"],
                **a["details"],
            },
        )
        session.add(record)
        session.flush()
        persisted_anomalies.append({
            "id": str(record.id),
            **a
        })

    session.commit()

    return {
        **res,
        "anomalies": persisted_anomalies,
    }


@router.get("/workspaces/{workspace_id}/datasets/{dataset_id}/anomalies")
def get_dataset_anomalies(
    workspace_id: uuid.UUID,
    dataset_id: uuid.UUID,
    current_user: ActiveUser,
    session: SessionDep
):
    _check_workspace_access(session, workspace_id, current_user.id)
    from app.db.models.analytics import Anomaly
    from app.db.models.datasets import DatasetVersion
    from sqlalchemy import select

    stmt = (
        select(Anomaly)
        .join(DatasetVersion, Anomaly.version_id == DatasetVersion.id)
        .where(
            Anomaly.workspace_id == workspace_id,
            DatasetVersion.dataset_id == dataset_id
        )
        .order_by(Anomaly.score.desc().nullslast(), Anomaly.created_at.desc())
    )
    records = session.execute(stmt).scalars().all()
    return [
        {
            "id": str(r.id),
            "version_id": str(r.version_id),
            "column_name": r.column_name,
            "method": r.method,
            "row_index": r.row_index,
            "observed_value": r.observed_value,
            "expected_value": r.expected_value,
            "score": r.score,
            "severity": r.severity.value if hasattr(r.severity, "value") else str(r.severity),
            "status": r.status.value if hasattr(r.status, "value") else str(r.status),
            "nature": r.details.get("nature") if r.details else "detected_anomaly",
            "title": r.details.get("title") if r.details else f"Anomaly in {r.column_name}",
            "explanation": r.details.get("explanation") if r.details else "",
            "details": r.details,
            "created_at": r.created_at,
        }
        for r in records
    ]


@router.patch("/workspaces/{workspace_id}/anomalies/{anomaly_id}")
def update_anomaly_status(
    workspace_id: uuid.UUID,
    anomaly_id: uuid.UUID,
    payload: AnomalyStatusUpdateRequest,
    current_user: ActiveUser,
    session: SessionDep
):
    _check_workspace_access(session, workspace_id, current_user.id)
    from app.db.models.analytics import Anomaly
    from app.db.enums import AnomalyStatus
    from sqlalchemy import select

    anomaly = session.execute(
        select(Anomaly).where(
            Anomaly.id == anomaly_id,
            Anomaly.workspace_id == workspace_id
        )
    ).scalar_one_or_none()

    if not anomaly:
        raise HTTPException(status_code=404, detail="Anomaly not found")

    try:
        anomaly.status = AnomalyStatus(payload.status.lower())
    except Exception:
        raise HTTPException(status_code=400, detail=f"Invalid status: {payload.status}")

    session.commit()
    return {"id": str(anomaly.id), "status": anomaly.status.value}

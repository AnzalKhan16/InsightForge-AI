import io
import uuid
import pandas as pd
import datetime
from typing import Any
from sqlalchemy import select
from app.db.session import get_sessionmaker
from app.db.models.datasets import DatasetVersion, DatasetArtifact, ProcessingJob
from app.db.enums import JobStatus, ArtifactKind, DatasetFormat
from app.core.storage import get_storage
import logging
import hashlib

logger = logging.getLogger(__name__)

def apply_cleaning_operation(df: pd.DataFrame, op_name: str, columns: list[str] | None, params: dict[str, Any] | None) -> pd.DataFrame:
    params = params or {}
    
    if op_name == "drop_duplicates":
        subset = columns if columns else None
        df = df.drop_duplicates(subset=subset)
        
    elif op_name == "drop_na":
        subset = columns if columns else None
        df = df.dropna(subset=subset)
        
    elif op_name == "fill_na":
        fill_value = params.get("value", "")
        if columns:
            for col in columns:
                df[col] = df[col].fillna(fill_value)
        else:
            df = df.fillna(fill_value)
            
    elif op_name == "trim_whitespace":
        target_cols = columns if columns else df.select_dtypes(include=['object', 'string']).columns
        for col in target_cols:
            df[col] = df[col].astype(str).str.strip()
                
    elif op_name == "convert_type":
        target_type = params.get("type")
        if target_type and columns:
            for col in columns:
                try:
                    if target_type == "numeric":
                        df[col] = pd.to_numeric(df[col], errors='coerce')
                    elif target_type == "datetime":
                        df[col] = pd.to_datetime(df[col], errors='coerce')
                    elif target_type == "string":
                        df[col] = df[col].astype(str)
                except Exception as e:
                    logger.warning(f"Failed to convert column {col} to {target_type}: {e}")
                    
    return df

def clean_dataset_task(job_id: uuid.UUID):
    try:
        with get_sessionmaker()() as session:
            job = session.execute(
                select(ProcessingJob).where(ProcessingJob.id == job_id)
            ).scalar_one_or_none()
            
            if not job:
                logger.error(f"Job {job_id} not found")
                return
                
            job.status = JobStatus.RUNNING
            job.started_at = datetime.datetime.now(datetime.timezone.utc)
            session.commit()
            
            try:
                version = session.execute(
                    select(DatasetVersion).where(DatasetVersion.id == job.version_id)
                ).scalar_one_or_none()
                
                if not version:
                    raise ValueError(f"Version {job.version_id} not found")
                
                storage = get_storage()
                file_obj = storage.get_file(version.raw_storage_key)
                file_bytes = file_obj.read()
                file_obj.close()
                
                # Load
                if version.format == DatasetFormat.CSV:
                    df = pd.read_csv(io.BytesIO(file_bytes))
                elif version.format in (DatasetFormat.XLSX, DatasetFormat.XLS):
                    df = pd.read_excel(io.BytesIO(file_bytes))
                else:
                    raise ValueError(f"Unsupported format: {version.format}")
                
                # Clean
                operations = job.params.get("operations", [])
                history = []
                
                initial_rows = len(df)
                for op in operations:
                    op_name = op.get("op")
                    columns = op.get("columns")
                    params = op.get("params")
                    
                    df = apply_cleaning_operation(df, op_name, columns, params)
                    history.append({
                        "operation": op_name,
                        "columns": columns,
                        "params": params,
                        "rows_after": len(df)
                    })
                
                # Export to Parquet
                parquet_buffer = io.BytesIO()
                df.to_parquet(parquet_buffer, index=False)
                parquet_bytes = parquet_buffer.getvalue()
                
                storage_key = f"{version.workspace_id}/{version.dataset_id}/{uuid.uuid4().hex}.parquet"
                storage.upload_file(io.BytesIO(parquet_bytes), storage_key)
                
                checksum = hashlib.sha256(parquet_bytes).hexdigest()
                
                # Delete existing cleaned artifact if any
                existing_artifact = session.execute(
                    select(DatasetArtifact).where(
                        DatasetArtifact.version_id == version.id,
                        DatasetArtifact.kind == ArtifactKind.CLEANED
                    )
                ).scalar_one_or_none()
                if existing_artifact:
                    session.delete(existing_artifact)
                
                # Save Artifact
                artifact = DatasetArtifact(
                    workspace_id=version.workspace_id,
                    version_id=version.id,
                    kind=ArtifactKind.CLEANED,
                    storage_key=storage_key,
                    file_format="parquet",
                    size_bytes=len(parquet_bytes),
                    checksum_sha256=checksum,
                    row_count=len(df)
                )
                session.add(artifact)
                session.flush()
                
                job.status = JobStatus.SUCCEEDED
                job.progress = 100
                job.finished_at = datetime.datetime.now(datetime.timezone.utc)
                job.result = {
                    "initial_rows": initial_rows,
                    "final_rows": len(df),
                    "history": history,
                    "artifact_id": str(artifact.id)
                }
                session.commit()
                
            except Exception as e:
                logger.exception("Error cleaning dataset")
                job.status = JobStatus.FAILED
                job.error_message = str(e)
                job.finished_at = datetime.datetime.now(datetime.timezone.utc)
                session.commit()
                
    except Exception as e:
        logger.exception("Fatal error in clean_dataset_task")

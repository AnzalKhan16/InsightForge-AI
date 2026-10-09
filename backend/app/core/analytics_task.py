import io
import uuid
import pandas as pd
import datetime
from sqlalchemy import select
from app.db.session import get_sessionmaker
from app.db.models.datasets import DatasetVersion, ProcessingJob
from app.db.models.analytics import SavedAnalysis
from app.db.enums import JobStatus, DatasetFormat
from app.core.storage import get_storage
from app.core.analytics import BusinessAnalyticsEngine
import logging

logger = logging.getLogger(__name__)

def analyze_dataset_task(job_id: uuid.UUID):
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
                
                # Fetch dataset (we should prefer cleaned artifact if exists, but for now we use raw)
                storage = get_storage()
                # Actually, if there is a processed or cleaned artifact, we should use it.
                # To keep it simple, we use raw storage key.
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
                
                engine = BusinessAnalyticsEngine(df)
                result = engine.analyze()
                
                # Save to SavedAnalysis
                analysis = SavedAnalysis(
                    workspace_id=version.workspace_id,
                    created_by_id=job.created_by_id,
                    version_id=version.id,
                    name=f"Auto Analysis v{version.version_number}",
                    analysis_type="auto_overview",
                    config={"engine": "BusinessAnalyticsEngine"},
                    result=result
                )
                session.add(analysis)
                
                job.status = JobStatus.SUCCEEDED
                job.progress = 100
                job.finished_at = datetime.datetime.now(datetime.timezone.utc)
                job.result = {"analysis_id": str(analysis.id), "summary": "Analysis complete"}
                session.commit()
                
            except Exception as e:
                logger.exception("Error analyzing dataset")
                job.status = JobStatus.FAILED
                job.error_message = str(e)
                job.finished_at = datetime.datetime.now(datetime.timezone.utc)
                session.commit()
                
    except Exception as e:
        logger.exception("Fatal error in analyze_dataset_task")

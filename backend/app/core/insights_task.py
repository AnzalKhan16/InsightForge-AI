import datetime
import io
import logging
import uuid

import pandas as pd
from sqlalchemy import select

from app.core.analytics import BusinessAnalyticsEngine
from app.core.insights import generate_insights_for_analysis
from app.core.storage import get_storage
from app.db.enums import DatasetFormat, JobStatus
from app.db.models.analytics import SavedAnalysis
from app.db.models.datasets import DatasetVersion, ProcessingJob
from app.db.session import get_sessionmaker

logger = logging.getLogger(__name__)


def generate_insights_task(job_id: uuid.UUID):
    """Background task to run deterministic analytics (if not already run) and generate grounded AI insights."""
    try:
        with get_sessionmaker()() as session:
            job = session.execute(
                select(ProcessingJob).where(ProcessingJob.id == job_id)
            ).scalar_one_or_none()

            if not job:
                logger.error(f"Job {job_id} not found")
                return

            job.status = JobStatus.RUNNING
            job.started_at = datetime.datetime.now(datetime.UTC)
            session.commit()

            try:
                version = session.execute(
                    select(DatasetVersion).where(DatasetVersion.id == job.version_id)
                ).scalar_one_or_none()

                if not version:
                    raise ValueError(f"Version {job.version_id} not found")

                # Check if analysis exists for this version
                analysis = session.execute(
                    select(SavedAnalysis)
                    .where(
                        SavedAnalysis.version_id == version.id,
                        SavedAnalysis.workspace_id == version.workspace_id,
                    )
                    .order_by(SavedAnalysis.created_at.desc())
                ).scalars().first()

                if not analysis or not analysis.result:
                    # Run deterministic analytics first
                    logger.info("No prior analysis found; running BusinessAnalyticsEngine first")
                    storage = get_storage()
                    file_obj = storage.get_file(version.raw_storage_key)
                    file_bytes = file_obj.read()
                    file_obj.close()

                    if version.format == DatasetFormat.CSV:
                        df = pd.read_csv(io.BytesIO(file_bytes))
                    elif version.format in (DatasetFormat.XLSX, DatasetFormat.XLS):
                        df = pd.read_excel(io.BytesIO(file_bytes))
                    else:
                        raise ValueError(f"Unsupported format: {version.format}")

                    engine = BusinessAnalyticsEngine(df)
                    analytics_result = engine.analyze()

                    analysis = SavedAnalysis(
                        workspace_id=version.workspace_id,
                        created_by_id=job.created_by_id,
                        version_id=version.id,
                        name=f"Auto Analysis v{version.version_number}",
                        analysis_type="auto_overview",
                        config={"engine": "BusinessAnalyticsEngine"},
                        result=analytics_result,
                    )
                    session.add(analysis)
                    session.flush()
                else:
                    analytics_result = analysis.result

                # Generate grounded insights
                new_insights = generate_insights_for_analysis(
                    workspace_id=version.workspace_id,
                    version_id=version.id,
                    analysis_id=analysis.id,
                    analytics_result=analytics_result,
                )

                for insight in new_insights:
                    session.add(insight)

                job.status = JobStatus.SUCCEEDED
                job.progress = 100
                job.finished_at = datetime.datetime.now(datetime.UTC)
                job.result = {
                    "insight_count": len(new_insights),
                    "summary": f"Successfully generated {len(new_insights)} grounded business insights",
                }
                session.commit()
                logger.info(f"Generated {len(new_insights)} insights for version {version.id}")

            except Exception as e:
                logger.exception("Error during insight generation")
                job.status = JobStatus.FAILED
                job.error_message = str(e)
                job.finished_at = datetime.datetime.now(datetime.UTC)
                session.commit()

    except Exception:
        logger.exception("Fatal error in generate_insights_task")

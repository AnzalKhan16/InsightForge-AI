"""InsightForge AI Background Worker Service.

Polls and processes asynchronous dataset profiling, data cleaning,
and analytical batch jobs from the ProcessingJob table and Redis queue.
"""
import logging
import signal
import time

from sqlalchemy import select

from app.core.analytics_task import analyze_dataset_task
from app.core.cleaning import clean_dataset_task
from app.db.enums import JobStatus, JobType
from app.db.models.datasets import ProcessingJob
from app.db.session import get_sessionmaker

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] [Worker] %(message)s")
logger = logging.getLogger("worker")

_RUNNING = True


def _handle_shutdown(signum, frame):
    global _RUNNING
    logger.info("Graceful shutdown signal received. Stopping worker loop...")
    _RUNNING = False


signal.signal(signal.SIGINT, _handle_shutdown)
signal.signal(signal.SIGTERM, _handle_shutdown)


def process_next_queued_job():
    """Fetches and executes the next pending ProcessingJob."""
    sm = get_sessionmaker()
    with sm() as session:
        # Atomic selection of one queued job
        job = session.execute(
            select(ProcessingJob)
            .where(ProcessingJob.status == JobStatus.QUEUED)
            .order_by(ProcessingJob.created_at.asc())
            .limit(1)
        ).scalar_one_or_none()

        if not job:
            return False

        job_id = job.id
        job_type = job.job_type
        logger.info(f"Picked up queued job: {job_id} of type {job_type}")

    # Dispatch to task handler
    try:
        if job_type == JobType.CLEAN:
            clean_dataset_task(job_id=job_id)
        elif job_type == JobType.ANALYZE:
            analyze_dataset_task(job_id=job_id)
        else:
            logger.warning(f"Unsupported job type {job_type} for job {job_id}")
            with sm() as session:
                j = session.get(ProcessingJob, job_id)
                if j:
                    j.status = JobStatus.FAILED
                    j.error_message = f"Unsupported job type: {job_type}"
                    session.commit()
    except Exception as exc:
        logger.exception(f"Unhandled error processing job {job_id}: {exc}")
        with sm() as session:
            j = session.get(ProcessingJob, job_id)
            if j:
                j.status = JobStatus.FAILED
                j.error_message = str(exc)
                session.commit()

    return True


def run_worker_loop(poll_interval: float = 2.0):
    """Main worker lifecycle loop."""
    logger.info("InsightForge AI Background Worker started. Listening for processing jobs...")
    while _RUNNING:
        try:
            had_work = process_next_queued_job()
            if not had_work:
                time.sleep(poll_interval)
        except Exception as e:
            logger.exception(f"Worker loop encountered unexpected error: {e}")
            time.sleep(poll_interval)

    logger.info("InsightForge AI Background Worker stopped cleanly.")


if __name__ == "__main__":
    run_worker_loop()

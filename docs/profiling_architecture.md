# Data Profiling Architecture

## Overview
The Data Profiling subsystem in InsightForge-AI is designed to automatically generate descriptive statistics and schema metadata whenever a new dataset is uploaded. This allows the system and the user to understand the shape, completeness, and quality of the raw data without executing manual queries.

## Components

1. **API Layer (`datasets.py`)**
   - The dataset upload endpoint accepts a file (CSV or Excel) and immediately writes it to object storage (currently mocked as a local file system storage).
   - It records a `DatasetVersion` row with `status=UPLOADED` and enqueues a background task using FastAPI's `BackgroundTasks`.

2. **Profiling Worker (`profiling.py`)**
   - The task runs asynchronously and transitions the version's status to `PROCESSING`.
   - It retrieves the raw file bytes from the `StorageBackend`.
   - The bytes are loaded into a `pandas.DataFrame`.
   - The system calculates:
     - Row and column counts.
     - Number of missing and unique values per column.
     - Basic descriptive statistics for numerical columns (min, max, mean, median).
     - Global dataset statistics (e.g. total duplicate rows).

3. **Data Model (`DatasetMetadata`)**
   - Once profiling completes, the results are stored in the `dataset_metadata` table.
   - This table has a 1-to-1 relationship with `DatasetVersion`.
   - It separates the heavy raw data from the lightweight, queryable schema summary which can be sent to the frontend or LLM agents rapidly.
   - The status of the `DatasetVersion` is then set to `COMPLETED` (or `FAILED` if an exception occurred).

4. **Frontend Integration**
   - The UI automatically polls the `/datasets` endpoint if any dataset is currently in the `uploaded` or `processing` state.
   - When the status turns to `completed`, a "View Profile" button unlocks.
   - The dataset profile page decodes the nested JSON in `DatasetMetadata.profile` and renders tables and metrics cards for the user.

## Future Extensibility
- **AI-assisted quality checks**: The structure includes a `quality` field where ML-driven anomaly detection scores can be inserted later.
- **Dedicated Workers**: As the system scales, the in-process `BackgroundTasks` will be replaced by a message queue (e.g., Celery, Redis Queue) where dedicated worker nodes process large files.

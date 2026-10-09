import io
import uuid
import pandas as pd
import datetime
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.db.session import SessionLocal
from app.db.models.datasets import DatasetVersion, DatasetMetadata
from app.db.enums import ProcessingStatus, DatasetFormat
from app.core.storage import get_storage
import logging

logger = logging.getLogger(__name__)

def profile_dataset_task(version_id: uuid.UUID, workspace_id: uuid.UUID, storage_key: str, format: DatasetFormat):
    try:
        with SessionLocal() as session:
            version = session.execute(
                select(DatasetVersion).where(DatasetVersion.id == version_id)
            ).scalar_one_or_none()
            
            if not version:
                logger.error(f"Version {version_id} not found")
                return
            
            version.status = ProcessingStatus.PROCESSING
            session.commit()
            
            try:
                storage = get_storage()
                file_obj = storage.get_file(storage_key)
                file_bytes = file_obj.read()
                file_obj.close()
                
                # Load with pandas
                if format == DatasetFormat.CSV:
                    df = pd.read_csv(io.BytesIO(file_bytes))
                elif format in (DatasetFormat.XLSX, DatasetFormat.XLS):
                    df = pd.read_excel(io.BytesIO(file_bytes))
                else:
                    raise ValueError(f"Unsupported format: {format}")
                
                # Profile
                row_count = int(len(df))
                column_count = int(len(df.columns))
                
                columns = []
                for col in df.columns:
                    col_series = df[col]
                    dtype = str(col_series.dtype)
                    null_count = int(col_series.isnull().sum())
                    unique_count = int(col_series.nunique())
                    
                    columns.append({
                        "name": str(col),
                        "dtype": dtype,
                        "null_count": null_count,
                        "unique_count": unique_count
                    })
                
                profile_data = {
                    "overview": {
                        "row_count": row_count,
                        "column_count": column_count,
                        "duplicate_rows": int(df.duplicated().sum())
                    },
                    "columns": {}
                }
                
                for col in df.columns:
                    col_series = df[col]
                    col_profile = {
                        "type": str(col_series.dtype),
                        "missing": int(col_series.isnull().sum()),
                        "unique": int(col_series.nunique())
                    }
                    if pd.api.types.is_numeric_dtype(col_series):
                        col_profile.update({
                            "min": float(col_series.min()) if not pd.isna(col_series.min()) else None,
                            "max": float(col_series.max()) if not pd.isna(col_series.max()) else None,
                            "mean": float(col_series.mean()) if not pd.isna(col_series.mean()) else None,
                            "median": float(col_series.median()) if not pd.isna(col_series.median()) else None,
                        })
                    profile_data["columns"][col] = col_profile
                
                # Save metadata
                metadata = DatasetMetadata(
                    workspace_id=workspace_id,
                    version_id=version_id,
                    row_count=row_count,
                    column_count=column_count,
                    columns=columns,
                    profile=profile_data,
                    quality={"score": 100}, # simple placeholder
                    profile_version=1
                )
                session.add(metadata)
                
                version.status = ProcessingStatus.COMPLETED
                version.processed_at = datetime.datetime.now(datetime.timezone.utc)
                session.commit()
                
            except Exception as e:
                logger.exception("Error profiling dataset")
                version.status = ProcessingStatus.FAILED
                version.error_message = str(e)
                session.commit()
                
    except Exception as e:
        logger.exception("Fatal error in profile_dataset_task")

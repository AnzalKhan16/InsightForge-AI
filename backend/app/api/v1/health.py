from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlalchemy import text

from app.core.config import get_settings
from app.db.session import get_engine

router = APIRouter(tags=["health"])


class HealthResponse(BaseModel):
    status: str
    service: str
    version: str
    environment: str
    timestamp: datetime


class ReadinessResponse(BaseModel):
    status: str
    service: str
    version: str
    environment: str
    database: str
    dependencies: dict[str, Any]
    timestamp: datetime


@router.get("/health", response_model=HealthResponse, summary="Liveness check")
@router.get("/health/live", response_model=HealthResponse, summary="Container liveness probe")
def health() -> HealthResponse:
    s = get_settings()
    return HealthResponse(
        status="ok",
        service=s.app_name,
        version=s.app_version,
        environment=s.environment,
        timestamp=datetime.now(UTC),
    )


@router.get("/health/ready", response_model=ReadinessResponse, summary="Container readiness probe")
def readiness() -> ReadinessResponse:
    s = get_settings()
    dependencies: dict[str, Any] = {}
    db_status = "connected"

    # 1. Verify Database Connectivity
    try:
        engine = get_engine()
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        dependencies["database"] = {"status": "healthy"}
    except Exception as e:
        db_status = "unavailable"
        dependencies["database"] = {"status": "unhealthy", "error": str(e)}
        raise HTTPException(
            status_code=503,
            detail={"status": "not_ready", "error": "Database connectivity failure", "dependencies": dependencies}
        ) from e

    # 2. Check Storage Directory Accessibility
    import os
    try:
        storage_path = s.storage_local_dir
        os.makedirs(storage_path, exist_ok=True)
        dependencies["storage"] = {"status": "healthy", "path": storage_path}
    except Exception as e:
        dependencies["storage"] = {"status": "degraded", "error": str(e)}

    return ReadinessResponse(
        status="ready",
        service=s.app_name,
        version=s.app_version,
        environment=s.environment,
        database=db_status,
        dependencies=dependencies,
        timestamp=datetime.now(UTC),
    )

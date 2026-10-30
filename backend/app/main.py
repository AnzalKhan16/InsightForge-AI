import logging
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.core.config import get_settings
from app.core.errors import register_exception_handlers
from app.db import models  # noqa: F401
from app.db.base import Base
from app.db.session import get_engine

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")


def _background_seed_if_empty() -> None:
    """Seeds the initial enterprise demo dataset in the background if database is fresh."""
    import os
    settings = get_settings()
    if settings.environment == "test" or os.getenv("PYTEST_CURRENT_TEST"):
        return

    try:
        from app.db.repositories.core import UserRepository
        from app.db.session import get_sessionmaker
        from scripts.seed_demo import seed

        with get_sessionmaker()() as session:
            user_repo = UserRepository(session)
            if not user_repo.get_by_email("demo@insightforge.ai"):
                logging.info("Fresh database detected: auto-seeding demo workspace in background...")
                seed()
                logging.info("Demo workspace seeding completed successfully.")
            else:
                logging.info("Database already initialized with demo user. Skipping auto-seed.")
    except Exception as exc:
        logging.warning(f"Background demo seed notice (non-fatal): {exc}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    import os
    import threading
    import time

    # Resilient schema check with retry loop for cloud deployments (e.g. Render Postgres initialization)
    engine = get_engine()
    retries = 15
    db_connected = False
    while retries > 0:
        try:
            Base.metadata.create_all(bind=engine)
            logging.info("Database schema initialized and verified successfully.")
            db_connected = True
            break
        except Exception as exc:
            retries -= 1
            logging.warning(
                f"Database connection attempt failed: {exc}. Retrying in 2s... ({retries} retries left)"
            )
            if retries > 0:
                time.sleep(2)

    settings = get_settings()
    if db_connected and settings.environment != "test" and not os.getenv("PYTEST_CURRENT_TEST"):
        # Run seeding in a daemon thread so Uvicorn can immediately open $PORT and pass health checks
        threading.Thread(target=_background_seed_if_empty, daemon=True).start()
    elif not db_connected:
        logging.error("Database connection could not be established during lifespan startup. Server will start to allow health checks.")

    yield


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        debug=settings.debug,
        docs_url="/docs",
        openapi_url=f"{settings.api_v1_prefix}/openapi.json",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins if isinstance(settings.cors_origins, list) else [settings.cors_origins],
        allow_origin_regex=r"^https:\/\/.*\.vercel\.app$",
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["X-Request-ID"],
    )

    @app.middleware("http")
    async def request_id_middleware(request: Request, call_next):
        request.state.request_id = request.headers.get("X-Request-ID") or uuid.uuid4().hex
        response = await call_next(request)
        response.headers["X-Request-ID"] = request.state.request_id
        return response

    register_exception_handlers(app)
    app.include_router(api_router, prefix=settings.api_v1_prefix)

    @app.get("/", tags=["health"], summary="Root service status")
    def root():
        return {
            "status": "ok",
            "service": settings.app_name,
            "version": settings.app_version,
            "docs": "/docs",
            "health": f"{settings.api_v1_prefix}/health"
        }

    return app


app = create_app()

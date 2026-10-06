"""Aggregates all v1 routers. New feature routers are registered here."""
from fastapi import APIRouter

from app.api.v1 import health, auth, workspaces

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(workspaces.router, prefix="/workspaces", tags=["workspaces"])

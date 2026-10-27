"""Health check route."""

from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(tags=["Health"])


class HealthResponse(BaseModel):
    status: str
    service: str
    version: str


@router.get("/health", response_model=HealthResponse)
async def get_health() -> HealthResponse:
    """Service health check endpoint."""
    return HealthResponse(
        status="ok",
        service="saarthi-ai-service",
        version="1.0.0",
    )


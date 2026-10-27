"""Main FastAPI application entry point for Saarthi AI Document Extraction & Intelligence Service."""

import logging
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.api.routes import extraction, health, rag
from app.core.config import get_settings
from app.schemas.extraction import ErrorResponse
from app.utils.file_validation import DocumentServiceException

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("saarthi.ai_service")


def create_app() -> FastAPI:
    """Application factory for Saarthi AI Extraction & RAG Service."""
    settings = get_settings()

    app = FastAPI(
        title="Saarthi AI Document Intelligence Service",
        description="Internal document processing, structured information extraction, and source-grounded RAG service",
        version="1.0.0",
        docs_url="/docs" if settings.ENVIRONMENT != "production" else None,
        redoc_url="/redoc" if settings.ENVIRONMENT != "production" else None,
    )

    # Register routers
    app.include_router(health.router)
    app.include_router(extraction.router)
    app.include_router(rag.router)

    # Custom exception handler for domain DocumentServiceException
    @app.exception_handler(DocumentServiceException)
    async def document_service_exception_handler(
        request: Request,
        exc: DocumentServiceException,
    ) -> JSONResponse:
        logger.warning(
            "DocumentServiceException [%s]: %s (status %d)",
            exc.error_code,
            exc.message,
            exc.status_code,
        )
        return JSONResponse(
            status_code=exc.status_code,
            content=ErrorResponse(
                error_code=exc.error_code,
                message=exc.message,
                details=exc.details if exc.details else None,
            ).model_dump(),
        )

    # Clean handler for validation errors (e.g. missing form fields)
    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(
        request: Request,
        exc: RequestValidationError,
    ) -> JSONResponse:
        logger.warning("Request validation error: %s", exc.errors())
        # Format field error safely without exposing raw payload
        first_error = exc.errors()[0] if exc.errors() else {}
        loc = " -> ".join(str(l) for l in first_error.get("loc", []))
        msg = first_error.get("msg", "Invalid request parameters")
        return JSONResponse(
            status_code=422,
            content=ErrorResponse(
                error_code="INVALID_DOCUMENT",
                message=f"Validation failed for {loc}: {msg}",
                details={"errors": exc.errors()},
            ).model_dump(),
        )

    # General unhandled exception handler
    @app.exception_handler(Exception)
    async def general_exception_handler(
        request: Request,
        exc: Exception,
    ) -> JSONResponse:
        logger.error("Unhandled server exception: %s", type(exc).__name__, exc_info=True)
        return JSONResponse(
            status_code=500,
            content=ErrorResponse(
                error_code="INTERNAL_ERROR",
                message="An unexpected internal server error occurred",
            ).model_dump(),
        )

    return app


app = create_app()

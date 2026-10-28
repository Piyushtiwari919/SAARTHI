"""Internal RAG API endpoints for service-to-service communication with Node.js."""

import logging
from fastapi import APIRouter, Depends, File, Form, Header, UploadFile

from app.api.routes.extraction import verify_internal_token
from app.core.config import Settings, get_settings
from app.rag.models import (
    RAGIndexResponse,
    RAGQueryRequest,
    RAGQueryResponse,
)
from app.rag.rag_service import RAGService
from app.services.document_loader import DocumentLoaderService
from app.services.ocr_service import OCRService
from app.utils.file_validation import read_and_validate_upload

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/internal/v1/rag", tags=["RAG Document Q&A"])

# Global singleton RAG service instance for persistent caching
_rag_service_instance: RAGService | None = None


def get_rag_service(settings: Settings = Depends(get_settings)) -> RAGService:
    global _rag_service_instance
    if _rag_service_instance is None:
        ocr_service = OCRService(settings)
        document_loader = DocumentLoaderService(settings, ocr_service)
        _rag_service_instance = RAGService(settings, document_loader)
    return _rag_service_instance


@router.post(
    "/index",
    response_model=RAGIndexResponse,
    dependencies=[Depends(verify_internal_token)],
    summary="Index a scholarship notice into vector store",
    description="Internal endpoint to chunk, embed, and store a SCHOLARSHIP_NOTICE document.",
)
async def index_document(
    file: UploadFile = File(..., description="Document binary file (PDF, JPEG, PNG)"),
    document_id: str = Form(..., description="Unique document ID from database"),
    document_title: str = Form(..., description="Display title for the document"),
    category: str = Form(..., description="Must be SCHOLARSHIP_NOTICE"),
    rag_service: RAGService = Depends(get_rag_service),
    settings: Settings = Depends(get_settings),
) -> RAGIndexResponse:
    # 1. Read and validate upload format and size
    file_bytes, file_format = await read_and_validate_upload(
        upload_file=file,
        max_bytes=settings.MAX_UPLOAD_BYTES,
    )

    # 2. Execute RAG indexing
    return await rag_service.index_document(
        document_id=document_id,
        document_title=document_title,
        file_bytes=file_bytes,
        file_format=file_format,
        category=category,
    )


@router.post(
    "/query",
    response_model=RAGQueryResponse,
    dependencies=[Depends(verify_internal_token)],
    summary="Ask a source-grounded question against an indexed scholarship notice",
    description="Internal endpoint for vector retrieval and grounded LLM synthesis.",
)
async def query_document(
    request: RAGQueryRequest,
    rag_service: RAGService = Depends(get_rag_service),
) -> RAGQueryResponse:
    return await rag_service.query_document(request)


@router.get(
    "/status/{document_id}",
    dependencies=[Depends(verify_internal_token)],
    summary="Check if a scholarship notice is indexed",
)
async def check_index_status(
    document_id: str,
    rag_service: RAGService = Depends(get_rag_service),
):
    is_indexed = rag_service.is_document_indexed(document_id)
    return {
        "document_id": document_id,
        "is_indexed": is_indexed,
        "status": "INDEXED" if is_indexed else "NOT_INDEXED",
    }


@router.delete(
    "/documents/{document_id}",
    dependencies=[Depends(verify_internal_token)],
    summary="Delete indexed chunks for a document",
)
async def delete_document_index(
    document_id: str,
    rag_service: RAGService = Depends(get_rag_service),
):
    deleted_count = rag_service.delete_document(document_id)
    return {
        "document_id": document_id,
        "deleted_chunks": deleted_count,
        "status": "PURGED",
    }


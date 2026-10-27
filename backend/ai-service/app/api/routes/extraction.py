"""Document extraction API endpoint for internal service-to-service communication."""

import secrets
from typing import Optional
from fastapi import APIRouter, Depends, File, Form, Header, UploadFile

from app.core.config import Settings, get_settings
from app.schemas.extraction import ExtractionResponse
from app.services.document_loader import DocumentLoaderService
from app.services.extraction_service import ExtractionService
from app.services.ocr_service import OCRService
from app.utils.file_validation import DocumentServiceException

router = APIRouter(prefix="/internal/v1/documents", tags=["Extraction"])


def verify_internal_token(
    x_internal_service_token: Optional[str] = Header(None, alias="X-Internal-Service-Token"),
    settings: Settings = Depends(get_settings),
) -> None:
    """
    Verify service-to-service authentication token using constant-time comparison.
    Rejects missing, empty, or mismatched tokens with 401 UNAUTHORIZED_INTERNAL_CALL.
    """
    if not settings.INTERNAL_SERVICE_TOKEN or not x_internal_service_token:
        raise DocumentServiceException(
            error_code="UNAUTHORIZED_INTERNAL_CALL",
            message="Missing or invalid internal service token",
            status_code=401,
        )

    # Constant time string comparison to prevent timing attacks
    if not secrets.compare_digest(
        x_internal_service_token.strip(),
        settings.INTERNAL_SERVICE_TOKEN.strip(),
    ):
        raise DocumentServiceException(
            error_code="UNAUTHORIZED_INTERNAL_CALL",
            message="Missing or invalid internal service token",
            status_code=401,
        )


def get_extraction_service(
    settings: Settings = Depends(get_settings),
) -> ExtractionService:
    """Factory dependency providing initialized ExtractionService."""
    ocr_service = OCRService(settings)
    document_loader = DocumentLoaderService(settings, ocr_service)
    return ExtractionService(settings, document_loader)


@router.post(
    "/extract",
    response_model=ExtractionResponse,
    dependencies=[Depends(verify_internal_token)],
    summary="Extract structured data from uploaded document",
    description=(
        "Internal service-to-service endpoint for document processing. "
        "Accepts PDF, JPEG, or PNG files for INCOME_CERTIFICATE or SCHOLARSHIP_NOTICE."
    ),
)
async def extract_document(
    file: UploadFile = File(..., description="Document file to extract (PDF, JPEG, PNG)"),
    document_type: str = Form(..., description="Target category: INCOME_CERTIFICATE or SCHOLARSHIP_NOTICE"),
    service: ExtractionService = Depends(get_extraction_service),
) -> ExtractionResponse:
    """Handle multipart file upload and coordinate structured information extraction."""
    return await service.process_document(
        file=file,
        document_type_str=document_type,
    )


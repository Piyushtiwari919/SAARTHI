"""Extraction orchestration service coordinating validation, loading, and extraction."""

import uuid
from typing import Optional
from fastapi import UploadFile

from app.core.config import Settings
from app.providers.base import BaseExtractionProvider
from app.providers.gemini_extractor import GeminiExtractionProvider
from app.providers.local_extractor import LocalExtractionProvider
from app.schemas.extraction import (
    DocumentType,
    ExtractionResponse,
    FieldExtractionStatus,
    ProcessingStatus,
)
from app.services.document_loader import DocumentLoaderService
from app.utils.file_validation import (
    read_and_validate_upload,
    validate_document_type,
    validate_pdf_structure,
)


class ExtractionService:
    """Orchestrates the entire document extraction pipeline."""

    def __init__(
        self,
        settings: Settings,
        document_loader: DocumentLoaderService,
        provider: Optional[BaseExtractionProvider] = None,
    ):
        self.settings = settings
        self.document_loader = document_loader
        self._provider = provider

    def _resolve_provider(self) -> BaseExtractionProvider:
        if self._provider is not None:
            return self._provider

        if self.settings.AI_PROVIDER == "gemini" and self.settings.is_gemini_configured():
            return GeminiExtractionProvider(self.settings)

        # Default fallback to deterministic local extractor
        return LocalExtractionProvider()

    async def process_document(
        self,
        file: UploadFile,
        document_type_str: str,
    ) -> ExtractionResponse:
        """
        Execute full extraction pipeline:
        1. Validate document type.
        2. Bounded file read and signature validation.
        3. Structural PDF / image checks and page count limits.
        4. Load document and extract text page by page (or OCR).
        5. Run extraction provider.
        6. Determine processing status and assemble ExtractionResponse.
        """
        request_id = str(uuid.uuid4())

        # 1. Validate document type
        document_type = validate_document_type(document_type_str)

        # 2. Read file with bounded buffer and validate signature
        file_bytes, file_format = await read_and_validate_upload(
            upload_file=file,
            max_bytes=self.settings.MAX_UPLOAD_BYTES,
        )

        # 3. If PDF, validate structure and enforce max pages
        if file_format == "pdf":
            validate_pdf_structure(
                pdf_bytes=file_bytes,
                max_pages=self.settings.MAX_PDF_PAGES,
            )

        # 4. Load pages and extract text / perform OCR
        loaded_doc = self.document_loader.load_document(
            file_bytes=file_bytes,
            file_format=file_format,
        )

        # 5. Extract structured data using chosen provider
        provider = self._resolve_provider()
        extraction_result = await provider.extract(
            document_type=document_type,
            pages=loaded_doc.pages,
        )

        # Combine warnings from loading and extraction
        all_warnings = list(loaded_doc.warnings) + list(extraction_result.warnings)

        # 6. Determine overall processing status
        has_needs_review = any(
            f.status == FieldExtractionStatus.NEEDS_REVIEW
            for f in extraction_result.extracted_fields
        )
        if extraction_result.eligibility_rules:
            if any(
                r.status == FieldExtractionStatus.NEEDS_REVIEW
                for r in extraction_result.eligibility_rules
            ):
                has_needs_review = True

        if has_needs_review:
            processing_status = ProcessingStatus.NEEDS_REVIEW
        else:
            processing_status = ProcessingStatus.COMPLETED

        return ExtractionResponse(
            request_id=request_id,
            document_type=document_type,
            processing_status=processing_status,
            page_count=loaded_doc.page_count,
            extracted_fields=extraction_result.extracted_fields,
            eligibility_rules=extraction_result.eligibility_rules,
            warnings=all_warnings,
            provider_used=extraction_result.provider_used,
            schema_version="1.0.0",
        )


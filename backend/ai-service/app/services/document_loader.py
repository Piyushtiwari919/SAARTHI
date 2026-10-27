"""Document loader service extracting text and structure from PDFs and images."""

import io
import logging
import re
from dataclasses import dataclass
from typing import List, Tuple
from PIL import Image
import pymupdf

from app.core.config import Settings
from app.services.ocr_service import OCRService
from app.utils.file_validation import DocumentServiceException

logger = logging.getLogger(__name__)

# Minimum alphanumeric characters to consider a page to have sufficient selectable text
MIN_USABLE_CHARS = 20


@dataclass
class PageContent:
    """Represents the extracted text and provenance for a single document page."""

    page_number: int  # 1-based
    text: str
    status: str  # TEXT_EXTRACTED, OCR_APPLIED, OCR_UNAVAILABLE, NO_USABLE_TEXT


@dataclass
class LoadedDocument:
    """Represents loaded and extracted text content across all document pages."""

    page_count: int
    pages: List[PageContent]
    warnings: List[str]


class DocumentLoaderService:
    """Loads PDF and image documents, extracting per-page text or invoking OCR as appropriate."""

    def __init__(self, settings: Settings, ocr_service: OCRService):
        self.settings = settings
        self.ocr_service = ocr_service

    def load_document(self, file_bytes: bytes, file_format: str) -> LoadedDocument:
        """
        Load document bytes and extract text page by page.

        Args:
            file_bytes: Raw binary content of the file.
            file_format: 'pdf', 'jpeg', or 'png'.

        Returns:
            LoadedDocument with page-level text and statuses.
        """
        if file_format == "pdf":
            return self._load_pdf(file_bytes)
        elif file_format in ("jpeg", "png"):
            return self._load_image(file_bytes)
        else:
            raise DocumentServiceException(
                error_code="UNSUPPORTED_FILE_TYPE",
                message=f"Unsupported format '{file_format}' for document loading",
                status_code=415,
            )

    def _load_pdf(self, pdf_bytes: bytes) -> LoadedDocument:
        pages: List[PageContent] = []
        warnings: List[str] = []
        ocr_needed_but_unavailable = False

        try:
            doc = pymupdf.open(stream=pdf_bytes, filetype="pdf")
        except Exception as exc:
            raise DocumentServiceException(
                error_code="INVALID_DOCUMENT",
                message="Failed to parse PDF document structure",
                status_code=422,
            ) from exc

        try:
            page_count = doc.page_count
            for page_idx in range(page_count):
                page_num = page_idx + 1
                page = doc.load_page(page_idx)
                raw_text = page.get_text("text") or ""
                cleaned_text = self._clean_text(raw_text)
                alphanumeric_count = len(re.findall(r"[A-Za-z0-9]", cleaned_text))

                if alphanumeric_count >= MIN_USABLE_CHARS:
                    pages.append(
                        PageContent(
                            page_number=page_num,
                            text=cleaned_text,
                            status="TEXT_EXTRACTED",
                        )
                    )
                else:
                    # Page lacks sufficient selectable text; attempt OCR if available
                    if self.ocr_service.is_available():
                        try:
                            pix = page.get_pixmap(dpi=200)
                            img = Image.open(io.BytesIO(pix.tobytes("png")))
                            ocr_text = self.ocr_service.extract_text_from_image(img)
                            cleaned_ocr = self._clean_text(ocr_text)
                            if cleaned_ocr:
                                pages.append(
                                    PageContent(
                                        page_number=page_num,
                                        text=cleaned_ocr,
                                        status="OCR_APPLIED",
                                    )
                                )
                            else:
                                pages.append(
                                    PageContent(
                                        page_number=page_num,
                                        text="",
                                        status="NO_USABLE_TEXT",
                                    )
                                )
                        except Exception as ocr_err:
                            logger.warning("OCR failed on page %d: %s", page_num, type(ocr_err).__name__)
                            pages.append(
                                PageContent(
                                    page_number=page_num,
                                    text="",
                                    status="NO_USABLE_TEXT",
                                )
                            )
                    else:
                        ocr_needed_but_unavailable = True
                        warnings.append(
                            f"Page {page_num} contains scanned content or insufficient selectable text, but OCR is unavailable."
                        )
                        pages.append(
                            PageContent(
                                page_number=page_num,
                                text=cleaned_text,  # Keep whatever small text existed
                                status="OCR_UNAVAILABLE",
                            )
                        )
        finally:
            doc.close()

        # Check whether any usable text was obtained across the entire document
        total_text_length = sum(len(p.text.strip()) for p in pages)
        if total_text_length == 0:
            if ocr_needed_but_unavailable:
                raise DocumentServiceException(
                    error_code="OCR_ENGINE_UNAVAILABLE",
                    message="Document requires OCR for scanned pages, but OCR engine is unavailable",
                    status_code=503,
                )
            raise DocumentServiceException(
                error_code="INVALID_DOCUMENT",
                message="No usable text could be found or extracted from the document",
                status_code=422,
            )

        return LoadedDocument(page_count=page_count, pages=pages, warnings=warnings)

    def _load_image(self, image_bytes: bytes) -> LoadedDocument:
        warnings: List[str] = []
        if not self.ocr_service.is_available():
            raise DocumentServiceException(
                error_code="OCR_ENGINE_UNAVAILABLE",
                message="Image documents require OCR, but Tesseract OCR engine is unavailable or not installed",
                status_code=503,
            )

        extracted_text = self.ocr_service.extract_text_from_image_bytes(image_bytes)
        cleaned_text = self._clean_text(extracted_text)

        if not cleaned_text:
            raise DocumentServiceException(
                error_code="INVALID_DOCUMENT",
                message="No readable text found in uploaded image",
                status_code=422,
            )

        page_content = PageContent(
            page_number=1,
            text=cleaned_text,
            status="OCR_APPLIED",
        )
        return LoadedDocument(page_count=1, pages=[page_content], warnings=warnings)

    @staticmethod
    def _clean_text(text: str) -> str:
        """Normalize line breaks and collapse excessive whitespace."""
        text = text.replace("\r\n", "\n").replace("\r", "\n")
        # Collapse multiple empty lines
        text = re.sub(r"\n{3,}", "\n\n", text)
        return text.strip()

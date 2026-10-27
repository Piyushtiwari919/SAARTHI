"""Tests for DocumentLoaderService, OCR routing, and page boundary preservation."""

from unittest.mock import MagicMock
import pytest

from app.core.config import Settings
from app.services.document_loader import DocumentLoaderService
from app.services.ocr_service import OCRService
from app.utils.file_validation import DocumentServiceException
from tests.conftest import create_synthetic_image, create_synthetic_pdf


def test_load_valid_text_pdf(test_settings: Settings):
    mock_ocr = MagicMock(spec=OCRService)
    mock_ocr.is_available.return_value = False
    loader = DocumentLoaderService(test_settings, mock_ocr)

    page1_text = "Page 1: Government Certificate of Income for verified student."
    page2_text = "Page 2: Terms and conditions regarding scholarship rules and compliance."
    pdf_bytes = create_synthetic_pdf([page1_text, page2_text])

    loaded = loader.load_document(pdf_bytes, file_format="pdf")
    assert loaded.page_count == 2
    assert len(loaded.pages) == 2
    assert loaded.pages[0].page_number == 1
    assert "Government Certificate of Income" in loaded.pages[0].text
    assert loaded.pages[0].status == "TEXT_EXTRACTED"
    assert loaded.pages[1].page_number == 2
    assert "scholarship rules" in loaded.pages[1].text
    assert loaded.pages[1].status == "TEXT_EXTRACTED"


def test_ocr_unavailable_when_scanned_pdf_needs_ocr(test_settings: Settings):
    # OCR is unavailable
    mock_ocr = MagicMock(spec=OCRService)
    mock_ocr.is_available.return_value = False
    loader = DocumentLoaderService(test_settings, mock_ocr)

    # Scanned PDF page with near-empty text (e.g. 5 chars)
    scanned_pdf = create_synthetic_pdf(["   "])

    with pytest.raises(DocumentServiceException) as exc_info:
        loader.load_document(scanned_pdf, file_format="pdf")
    assert exc_info.value.error_code == "OCR_ENGINE_UNAVAILABLE"
    assert exc_info.value.status_code == 503


def test_ocr_unavailable_when_image_uploaded(test_settings: Settings):
    mock_ocr = MagicMock(spec=OCRService)
    mock_ocr.is_available.return_value = False
    loader = DocumentLoaderService(test_settings, mock_ocr)

    image_bytes = create_synthetic_image("PNG")

    with pytest.raises(DocumentServiceException) as exc_info:
        loader.load_document(image_bytes, file_format="png")
    assert exc_info.value.error_code == "OCR_ENGINE_UNAVAILABLE"
    assert exc_info.value.status_code == 503


def test_ocr_success_on_image(test_settings: Settings):
    mock_ocr = MagicMock(spec=OCRService)
    mock_ocr.is_available.return_value = True
    mock_ocr.extract_text_from_image_bytes.return_value = (
        "GOVERNMENT OF MAHARASHTRA\nIncome: Rs. 1,50,000"
    )
    loader = DocumentLoaderService(test_settings, mock_ocr)

    image_bytes = create_synthetic_image("PNG")
    loaded = loader.load_document(image_bytes, file_format="png")

    assert loaded.page_count == 1
    assert loaded.pages[0].page_number == 1
    assert loaded.pages[0].status == "OCR_APPLIED"
    assert "1,50,000" in loaded.pages[0].text


def test_ocr_empty_text_on_image_raises_invalid_document(test_settings: Settings):
    mock_ocr = MagicMock(spec=OCRService)
    mock_ocr.is_available.return_value = True
    mock_ocr.extract_text_from_image_bytes.return_value = "   "
    loader = DocumentLoaderService(test_settings, mock_ocr)

    image_bytes = create_synthetic_image("JPEG")
    with pytest.raises(DocumentServiceException) as exc_info:
        loader.load_document(image_bytes, file_format="jpeg")
    assert exc_info.value.error_code == "INVALID_DOCUMENT"
    assert "No readable text found" in exc_info.value.message


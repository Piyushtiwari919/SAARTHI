"""Tests for file validation, size limits, signatures, PDF integrity, and temp cleanup."""

import io
import os
import pytest
from fastapi import UploadFile

from app.schemas.extraction import DocumentType
from app.utils.file_validation import (
    DocumentServiceException,
    detect_file_format,
    read_and_validate_upload,
    safe_temporary_file,
    validate_document_type,
    validate_pdf_structure,
)
from tests.conftest import create_synthetic_pdf


def test_detect_file_format_signatures():
    assert detect_file_format(b"%PDF-1.4...") == "pdf"
    assert detect_file_format(b"\xff\xd8\xff\xe0...") == "jpeg"
    assert detect_file_format(b"\x89PNG\r\n\x1a\n...") == "png"
    assert detect_file_format(b"GIF89a...") is None
    assert detect_file_format(b"Hello plain text") is None


@pytest.mark.asyncio
async def test_empty_file_rejected():
    upload = UploadFile(filename="empty.pdf", file=io.BytesIO(b""))
    with pytest.raises(DocumentServiceException) as exc_info:
        await read_and_validate_upload(upload, max_bytes=1000)
    assert exc_info.value.error_code == "EMPTY_FILE"
    assert exc_info.value.status_code == 400


@pytest.mark.asyncio
async def test_file_too_large_rejected():
    # 500 bytes with max 100 bytes limit
    large_content = b"%PDF-" + b"0" * 400
    upload = UploadFile(filename="big.pdf", file=io.BytesIO(large_content))
    with pytest.raises(DocumentServiceException) as exc_info:
        await read_and_validate_upload(upload, max_bytes=100)
    assert exc_info.value.error_code == "FILE_TOO_LARGE"
    assert exc_info.value.status_code == 413


@pytest.mark.asyncio
async def test_unsupported_file_type_signature():
    # File named .pdf but containing plain text signature
    fake_pdf = b"This is not a real PDF file."
    upload = UploadFile(filename="fake.pdf", file=io.BytesIO(fake_pdf))
    with pytest.raises(DocumentServiceException) as exc_info:
        await read_and_validate_upload(upload, max_bytes=1000)
    assert exc_info.value.error_code == "UNSUPPORTED_FILE_TYPE"
    assert exc_info.value.status_code == 415


def test_validate_document_type_valid_and_invalid():
    assert validate_document_type("INCOME_CERTIFICATE") == DocumentType.INCOME_CERTIFICATE
    assert validate_document_type("SCHOLARSHIP_NOTICE") == DocumentType.SCHOLARSHIP_NOTICE

    with pytest.raises(DocumentServiceException) as exc_info:
        validate_document_type("PASSPORT")
    assert exc_info.value.error_code == "UNSUPPORTED_DOCUMENT_TYPE"
    assert exc_info.value.status_code == 422


def test_malformed_pdf_rejected():
    corrupted_pdf = b"%PDF-corrupted-bytes-cannot-open"
    with pytest.raises(DocumentServiceException) as exc_info:
        validate_pdf_structure(corrupted_pdf, max_pages=10)
    assert exc_info.value.error_code == "INVALID_DOCUMENT"
    assert exc_info.value.status_code == 422


def test_pdf_page_limit_enforced():
    # Create PDF with 4 pages
    pdf_bytes = create_synthetic_pdf(["P1", "P2", "P3", "P4"])
    # Validate with max_pages=2
    with pytest.raises(DocumentServiceException) as exc_info:
        validate_pdf_structure(pdf_bytes, max_pages=2)
    assert exc_info.value.error_code == "INVALID_DOCUMENT"
    assert "exceeds limit of 2 pages" in exc_info.value.message


def test_temporary_file_cleanup_on_success():
    saved_path = None
    with safe_temporary_file(suffix=".pdf") as temp_path:
        saved_path = temp_path
        assert os.path.exists(saved_path)
        with open(saved_path, "wb") as f:
            f.write(b"sample temp content")
        assert os.path.getsize(saved_path) > 0

    # Ensure file is removed after context exit
    assert not os.path.exists(saved_path)


def test_temporary_file_cleanup_on_failure():
    saved_path = None
    try:
        with safe_temporary_file(suffix=".pdf") as temp_path:
            saved_path = temp_path
            assert os.path.exists(saved_path)
            raise RuntimeError("Simulated processing error")
    except RuntimeError:
        pass

    # Ensure file is removed even when exception occurs
    assert saved_path is not None
    assert not os.path.exists(saved_path)


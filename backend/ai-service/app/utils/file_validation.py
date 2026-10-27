"""File validation, size limits, signature checking, and temp file management."""

import os
import tempfile
from contextlib import contextmanager
from typing import Generator, Optional, Tuple
from fastapi import UploadFile
import pymupdf

from app.schemas.extraction import DocumentType


class DocumentServiceException(Exception):
    """Domain exception with stable programmatic error code and HTTP status code."""

    def __init__(
        self,
        error_code: str,
        message: str,
        status_code: int = 400,
        details: Optional[dict] = None,
    ):
        super().__init__(message)
        self.error_code = error_code
        self.message = message
        self.status_code = status_code
        self.details = details or {}


# Known file signatures (magic bytes)
MAGIC_PDF = b"%PDF-"
MAGIC_JPEG = b"\xff\xd8\xff"
MAGIC_PNG = b"\x89PNG\r\n\x1a\n"


def detect_file_format(header_bytes: bytes) -> Optional[str]:
    """Detect file format based on binary signature rather than user-supplied filename."""
    if header_bytes.startswith(MAGIC_PDF):
        return "pdf"
    if header_bytes.startswith(MAGIC_JPEG):
        return "jpeg"
    if header_bytes.startswith(MAGIC_PNG):
        return "png"
    return None


async def read_and_validate_upload(
    upload_file: UploadFile,
    max_bytes: int,
) -> Tuple[bytes, str]:
    """
    Read uploaded file content using bounded reads to prevent memory exhaustion,
    and validate file size and signature.

    Returns:
        Tuple of (file_bytes, format_type) where format_type is 'pdf', 'jpeg', or 'png'.
    """
    chunk_size = 64 * 1024  # 64 KB chunks
    total_read = 0
    buffer = bytearray()

    while True:
        chunk = await upload_file.read(chunk_size)
        if not chunk:
            break
        total_read += len(chunk)
        if total_read > max_bytes:
            raise DocumentServiceException(
                error_code="FILE_TOO_LARGE",
                message=f"File exceeds maximum allowed size of {max_bytes} bytes (10 MB)",
                status_code=413,
            )
        buffer.extend(chunk)

    if total_read == 0:
        raise DocumentServiceException(
            error_code="EMPTY_FILE",
            message="Uploaded file is empty (0 bytes)",
            status_code=400,
        )

    file_bytes = bytes(buffer)
    format_type = detect_file_format(file_bytes[:16])

    if not format_type:
        raise DocumentServiceException(
            error_code="UNSUPPORTED_FILE_TYPE",
            message="Unsupported file type. Only PDF, JPEG, and PNG files are accepted",
            status_code=415,
        )

    return file_bytes, format_type


def validate_document_type(doc_type_raw: str) -> DocumentType:
    """Validate that the provided document_type string is a supported enum value."""
    try:
        return DocumentType(doc_type_raw.strip())
    except (ValueError, AttributeError):
        supported = [dt.value for dt in DocumentType]
        raise DocumentServiceException(
            error_code="UNSUPPORTED_DOCUMENT_TYPE",
            message=f"Unsupported document type: '{doc_type_raw}'. Supported types: {', '.join(supported)}",
            status_code=422,
            details={"supported_types": supported},
        )


def validate_pdf_structure(pdf_bytes: bytes, max_pages: int) -> int:
    """
    Validate PDF structure and page count using PyMuPDF.

    Returns:
        The validated page count.
    """
    try:
        doc = pymupdf.open(stream=pdf_bytes, filetype="pdf")
    except Exception as exc:
        raise DocumentServiceException(
            error_code="INVALID_DOCUMENT",
            message="Uploaded PDF is malformed or corrupted",
            status_code=422,
        ) from exc

    try:
        if doc.is_encrypted:
            raise DocumentServiceException(
                error_code="INVALID_DOCUMENT",
                message="Password-protected or encrypted PDFs are not supported",
                status_code=422,
            )

        page_count = doc.page_count
        if page_count == 0:
            raise DocumentServiceException(
                error_code="INVALID_DOCUMENT",
                message="PDF contains no pages",
                status_code=422,
            )

        if page_count > max_pages:
            raise DocumentServiceException(
                error_code="INVALID_DOCUMENT",
                message=f"PDF page count ({page_count}) exceeds limit of {max_pages} pages",
                status_code=422,
                details={"page_count": page_count, "max_pages": max_pages},
            )

        return page_count
    finally:
        doc.close()


@contextmanager
def safe_temporary_file(suffix: str = ".tmp") -> Generator[str, None, None]:
    """
    Context manager creating a temporary file that is guaranteed to be deleted
    on exit (both success and failure). Does not leak path to callers.
    """
    fd, path = tempfile.mkstemp(suffix=suffix)
    os.close(fd)
    try:
        yield path
    finally:
        try:
            if os.path.exists(path):
                os.remove(path)
        except OSError:
            pass

"""OCR service supporting Tesseract (pytesseract) with automatic fallback to RapidOCR (ONNX Runtime)."""

import hashlib
import io
import logging
import os
import re
from typing import Dict, Optional
import numpy as np
from PIL import Image
import pytesseract

from app.core.config import Settings
from app.utils.file_validation import DocumentServiceException

logger = logging.getLogger(__name__)

COMMON_WINDOWS_TESSERACT_PATHS = [
    r"C:\Program Files\Tesseract-OCR\tesseract.exe",
    r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
    os.path.expandvars(r"%LOCALAPPDATA%\Programs\Tesseract-OCR\tesseract.exe"),
]

# Module-level singleton for RapidOCR ONNX engine and recent image byte cache
# so extraction + immediate RAG indexing do not run OCR twice on the same image.
_GLOBAL_RAPIDOCR_ENGINE = None
_OCR_BYTES_CACHE: Dict[str, str] = {}
_MAX_OCR_CACHE_ENTRIES = 64
_OCR_CACHE_VERSION = "v2"


def _normalize_ocr_text(text: str) -> str:
    """
    Clean common OCR spacing artifacts where adjacent words or field labels/values
    are concatenated without spaces (e.g. 'CertificateNo.INC-1', 'Father'sName:Lord').
    """
    if not text:
        return ""
    # Separate glued inline field labels preceded by alphanumeric characters
    text = re.sub(
        r"([A-Za-z0-9])(?=(?:Roll\s*No|Admission\s*No|School\s*Code|Certificate\s*No|Date\s*of\s*Issue|Date\s*of\s*Birth)\b)",
        r"\1 ",
        text,
    )
    # Separate 's followed immediately by uppercase letter (e.g. Father'sName -> Father's Name)
    text = re.sub(r"('s)([A-Z])", r"\1 \2", text)
    # Separate lowercase letter followed immediately by uppercase letter (e.g. CertificateNo -> Certificate No)
    text = re.sub(r"([a-z])([A-Z])", r"\1 \2", text)
    # Separate No. or Code followed immediately by alphanumeric value (e.g. No.INC-1 -> No. INC-1)
    text = re.sub(r"\b(No\.|Code)([A-Za-z0-9])", r"\1 \2", text)
    # Ensure space after colon when followed by a letter or digit (excluding time like 12:30)
    text = re.sub(r"([A-Za-z]):([A-Za-z0-9])", r"\1: \2", text)
    # Ensure spaces around ampersands between words
    text = re.sub(r"([A-Za-z])&([A-Za-z])", r"\1 & \2", text)
    text = re.sub(r"([A-Za-z])\s+&([A-Za-z])", r"\1 & \2", text)
    text = re.sub(r"([A-Za-z])&\s+([A-Za-z])", r"\1 & \2", text)
    # Collapse multiple horizontal spaces
    text = re.sub(r"[ \t]{2,}", " ", text)
    return text.strip()


class OCRService:
    """Service handling optical character recognition for scanned pages and images."""

    def __init__(self, settings: Settings):
        self.settings = settings
        if self.settings.TESSERACT_CMD:
            pytesseract.pytesseract.tesseract_cmd = self.settings.TESSERACT_CMD
        else:
            for candidate in COMMON_WINDOWS_TESSERACT_PATHS:
                if candidate and os.path.isfile(candidate):
                    pytesseract.pytesseract.tesseract_cmd = candidate
                    break

    def _is_tesseract_available(self) -> bool:
        try:
            pytesseract.get_tesseract_version()
            return True
        except Exception:
            return False

    def _get_rapidocr_engine(self):
        global _GLOBAL_RAPIDOCR_ENGINE
        if _GLOBAL_RAPIDOCR_ENGINE is not None:
            return _GLOBAL_RAPIDOCR_ENGINE
        try:
            from rapidocr_onnxruntime import RapidOCR

            _GLOBAL_RAPIDOCR_ENGINE = RapidOCR()
            return _GLOBAL_RAPIDOCR_ENGINE
        except Exception:
            return None

    def is_available(self) -> bool:
        """Check if either Tesseract binary or embedded RapidOCR (ONNX Runtime) is available."""
        if not self.settings.OCR_ENABLED:
            return False
        if self._is_tesseract_available():
            return True
        if self._get_rapidocr_engine() is not None:
            return True
        return False

    def extract_text_from_image(self, image: Image.Image) -> str:
        """
        Extract text from a PIL Image using Tesseract or RapidOCR (ONNX Runtime).

        Raises:
            DocumentServiceException with OCR_ENGINE_UNAVAILABLE if no OCR engine is available.
        """
        if not self.settings.OCR_ENABLED:
            raise DocumentServiceException(
                error_code="OCR_ENGINE_UNAVAILABLE",
                message="OCR processing is disabled in configuration",
                status_code=503,
            )

        if self._is_tesseract_available():
            try:
                text = pytesseract.image_to_string(image)
                return _normalize_ocr_text(text)
            except DocumentServiceException:
                raise
            except Exception as exc:
                logger.error("Tesseract OCR execution failed: %s", type(exc).__name__)
                raise DocumentServiceException(
                    error_code="EXTRACTION_FAILED",
                    message="Optical character recognition failed during execution",
                    status_code=422,
                ) from exc

        rapid_engine = self._get_rapidocr_engine()
        if rapid_engine is not None:
            try:
                rgb_img = image.convert("RGB")
                img_array = np.array(rgb_img)
                result, _ = rapid_engine(img_array)
                if not result:
                    return ""
                lines = [str(item[1]).strip() for item in result if len(item) >= 2 and str(item[1]).strip()]
                return _normalize_ocr_text("\n".join(lines))
            except DocumentServiceException:
                raise
            except Exception as exc:
                logger.error("RapidOCR execution failed: %s", type(exc).__name__)
                raise DocumentServiceException(
                    error_code="EXTRACTION_FAILED",
                    message="Optical character recognition failed during execution",
                    status_code=422,
                ) from exc

        raise DocumentServiceException(
            error_code="OCR_ENGINE_UNAVAILABLE",
            message=(
                "OCR engine is unavailable on this server. "
                "Please install rapidocr-onnxruntime or Tesseract OCR."
            ),
            status_code=503,
        )

    def extract_text_from_image_bytes(self, image_bytes: bytes) -> str:
        """Extract text from raw image bytes (JPEG / PNG) with content-hash caching."""
        digest = f"{_OCR_CACHE_VERSION}_{hashlib.sha256(image_bytes).hexdigest()}"
        if digest in _OCR_BYTES_CACHE:
            return _OCR_BYTES_CACHE[digest]

        try:
            with Image.open(io.BytesIO(image_bytes)) as img:
                text = self.extract_text_from_image(img)
                if len(_OCR_BYTES_CACHE) >= _MAX_OCR_CACHE_ENTRIES:
                    _OCR_BYTES_CACHE.clear()
                _OCR_BYTES_CACHE[digest] = text
                return text
        except DocumentServiceException:
            raise
        except Exception as exc:
            raise DocumentServiceException(
                error_code="INVALID_DOCUMENT",
                message="Uploaded image could not be decoded",
                status_code=422,
            ) from exc
